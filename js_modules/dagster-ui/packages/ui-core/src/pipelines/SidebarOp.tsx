import {gql, useQuery} from '@apollo/client';
import {Box, Colors, NonIdealState} from '@dagster-io/ui-components';
import * as React from 'react';

import {OpNameOrPath} from '../ops/OpNameOrPath';
import {LoadingSpinner} from '../ui/Loading';
import {RepoAddress} from '../workspace/types';

import {ExplorerPath} from './PipelinePathUtils';
import {SidebarOpDefinition, SIDEBAR_OP_DEFINITION_FRAGMENT} from './SidebarOpDefinition';
import {SidebarOpExecutionGraphs} from './SidebarOpExecutionGraphs';
import {SidebarOpInvocation, SIDEBAR_OP_INVOCATION_FRAGMENT} from './SidebarOpInvocation';
import {
  SidebarGraphOpQuery,
  SidebarGraphOpQueryVariables,
  SidebarOpFragment,
  SidebarPipelineOpQuery,
  SidebarPipelineOpQueryVariables,
} from './types/SidebarOp.types';

interface SidebarOpProps {
  handleID: string;
  explorerPath: ExplorerPath;
  showingSubgraph: boolean;
  parentOpHandleID?: string;
  getInvocations?: (definitionName: string) => {handleID: string}[];
  onEnterSubgraph?: (arg: OpNameOrPath) => void;
  onClickOp: (arg: OpNameOrPath) => void;
  repoAddress?: RepoAddress;
  isGraph: boolean;
}

const useSidebarOpQuery = (
  name: string,
  handleID: string,
  isGraph: boolean,
  repoAddress?: RepoAddress,
) => {
  const pipelineResult = useQuery<SidebarPipelineOpQuery, SidebarPipelineOpQueryVariables>(
    SIDEBAR_PIPELINE_OP_QUERY,
    {
      variables: {
        selector: {
          repositoryName: repoAddress?.name || '',
          repositoryLocationName: repoAddress?.location || '',
          pipelineName: name,
        },
        handleID,
      },
      skip: isGraph,
    },
  );

  const graphResult = useQuery<SidebarGraphOpQuery, SidebarGraphOpQueryVariables>(
    SIDEBAR_GRAPH_OP_QUERY,
    {
      variables: {
        selector: {
          repositoryName: repoAddress?.name || '',
          repositoryLocationName: repoAddress?.location || '',
          graphName: name,
        },
        handleID,
      },
      skip: !isGraph,
    },
  );

  if (isGraph) {
    const {error, data, loading} = graphResult;
    const solidContainer: SidebarOpFragment | undefined =
      data?.graphOrError.__typename === 'Graph' ? data.graphOrError : undefined;
    return {
      error,
      solidContainer,
      isLoading: !!loading,
    };
  }

  const {error, data, loading} = pipelineResult;
  const solidContainer: SidebarOpFragment | undefined =
    data?.pipelineOrError.__typename === 'Pipeline' ? data.pipelineOrError : undefined;
  return {
    error,
    solidContainer,
    isLoading: !!loading,
  };
};

export const SidebarOp = ({
  handleID,
  explorerPath,
  getInvocations,
  showingSubgraph,
  onEnterSubgraph,
  onClickOp,
  repoAddress,
  isGraph,
}: SidebarOpProps) => {
  const {error, solidContainer, isLoading} = useSidebarOpQuery(
    explorerPath.pipelineName,
    handleID,
    isGraph,
    repoAddress,
  );
  if (error) {
    return (
      <Box padding={64} flex={{justifyContent: 'center'}}>
        <NonIdealState icon="error" title="GraphQL Error - see console for details" />
      </Box>
    );
  }

  if (isLoading) {
    return <LoadingSpinner purpose="section" />;
  }

  if (!solidContainer) {
    return (
      <Box padding={{vertical: 16, horizontal: 24}} style={{color: Colors.Gray500}}>
        Could not load ops.
      </Box>
    );
  }

  return (
    <>
      <SidebarOpInvocation
        key={`${handleID}-inv`}
        solid={solidContainer!.solidHandle!.solid}
        onEnterSubgraph={
          solidContainer!.solidHandle!.solid.definition.__typename === 'CompositeSolidDefinition'
            ? onEnterSubgraph
            : undefined
        }
      />
      {!isGraph && repoAddress && (
        <SidebarOpExecutionGraphs
          key={`${handleID}-graphs`}
          handleID={handleID}
          solidName={solidContainer!.solidHandle!.solid.name}
          pipelineName={explorerPath.pipelineName}
          repoAddress={repoAddress}
        />
      )}
      <SidebarOpDefinition
        key={`${handleID}-def`}
        showingSubgraph={showingSubgraph}
        definition={solidContainer!.solidHandle!.solid.definition}
        getInvocations={getInvocations}
        onClickInvocation={({handleID}) => onClickOp({path: handleID.split('.')})}
        repoAddress={repoAddress}
      />
    </>
  );
};

const SIDEBAR_OP_FRAGMENT = gql`
  fragment SidebarOpFragment on SolidContainer {
    id
    name
    solidHandle(handleID: $handleID) {
      solid {
        ...SidebarOpInvocationFragment

        definition {
          ...SidebarOpDefinitionFragment
        }
      }
    }
  }

  ${SIDEBAR_OP_INVOCATION_FRAGMENT}
  ${SIDEBAR_OP_DEFINITION_FRAGMENT}
`;

const SIDEBAR_PIPELINE_OP_QUERY = gql`
  query SidebarPipelineOpQuery($selector: PipelineSelector!, $handleID: String!) {
    pipelineOrError(params: $selector) {
      ... on Pipeline {
        id
        ...SidebarOpFragment
      }
    }
  }

  ${SIDEBAR_OP_FRAGMENT}
`;

const SIDEBAR_GRAPH_OP_QUERY = gql`
  query SidebarGraphOpQuery($selector: GraphSelector!, $handleID: String!) {
    graphOrError(selector: $selector) {
      ... on Graph {
        id
        ...SidebarOpFragment
      }
    }
  }

  ${SIDEBAR_OP_FRAGMENT}
`;
