import React from 'react';
import { DataFrame, PanelProps } from '@grafana/data';
import { SimpleOptions } from 'types';
import { css, cx } from '@emotion/css';
import { colors, useStyles2, useTheme2 } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import { node } from 'webpack';

interface Props extends PanelProps<SimpleOptions> {}

const getStyles = () => {
  return {
    wrapper: css`
      font-family: Open Sans;
      position: relative;
    `,
    svg: css`
      position: absolute;
      top: 0;
      left: 0;
    `,
    textBox: css`
      position: absolute;
      bottom: 0;
      left: 0;
      padding: 10px;
    `,
  };
};
class Node {
  nodeName: string
  clusterName: string
  constructor(nodeName: string, clusterName: string){
    this.nodeName = nodeName
    this.clusterName = clusterName
  }

  Equals(node: Node): boolean {
    return node.nodeName == this.nodeName
  }

  EqualsCluster(node: Node): boolean {
    return node.clusterName == this.clusterName
  }

}
class Edge {
  sourceNode: Node
  targetNode: Node

  constructor(sourceNode: Node, targetNode: Node) {
    this.sourceNode = sourceNode
    this.targetNode = targetNode
  }

  Equals(edge: Edge) : boolean {
    return this.sourceNode.Equals(edge.sourceNode) && this.targetNode.Equals(edge.targetNode)
  }
}



class Cluster {
  nodes: Node[] = []
  edges: Edge[] = []
  topology: Topology
  clusterName: string

  constructor(clusterName: string, topology: Topology) {
    this.clusterName = clusterName
    this.topology = topology
  }
}

class Topology {
  clusters: Cluster[] = []
  nodes: Node[] = []
  spacing: number = 35
  start_transform_x: number = 0
  start_transform_y: number = 0

  constructor(start_tranform_x: number, start_transform_y: number, spacing: number) {
    this.start_transform_x = start_tranform_x
    this.start_transform_y = start_transform_y
    this.spacing = spacing
  }
  
  SortNodes(): Node[] {
    return this.nodes.sort(function(n1: Node,n2: Node) {
      if (!n1.nodeName || !n2.nodeName){
        return -1
      }
    
      if (n1.nodeName < n2.nodeName) {
        return -1
      }
      if (n1.nodeName > n2.nodeName) {
        return 1
      }
      return 0
    });
  }
  GetNodeTransform_x(node: Node): number {
    let nodeOrdered: Node[] = this.SortNodes()

    let index = nodeOrdered.findIndex((n) => n.nodeName == node.nodeName)
    if (index == -1) {
      return -1;
    }

    if (index % 2 == 0 ) {
      return this.start_transform_x
    }
    return this.start_transform_x + this.spacing * (Math.floor(index / 4) + 1)
  }
  GetNodeTransform_y(node: Node): number {
    let nodeOrdered: Node[] = this.SortNodes()

    let index = nodeOrdered.findIndex((n) => n.nodeName == node.nodeName)
    if (index == -1) {
      return -1;
    }

    if (index % 4 == 0 || index % 4 == 1 ) {
      return this.start_transform_y
    }

    return this.start_transform_y + this.spacing * (Math.floor(index / 4) + 1)
  }
  SortClusters(): Cluster[] {
    return this.clusters.sort(function(c1: Cluster,c2: Cluster) {
      if (!c1.clusterName || !c2.clusterName){
        return -1
      }
    
      if (c1.clusterName < c2.clusterName) {
        return -1
      }
      if (c1.clusterName > c2.clusterName) {
        return 1
      }
      return 0
    });
  }
  GetClusterTransform_x(cluster: Cluster): number {
    let clusterOrdered: Cluster[] = this.SortClusters()

    let index = clusterOrdered.findIndex((c) => c.clusterName == cluster.clusterName)
    if (index == -1) {
      return -1;
    }

    if (index % 2 == 0 ) {
      return this.start_transform_x
    }
    return this.start_transform_x + Math.max(...cluster.topology.nodes.map((n: Node) => cluster.topology.GetNodeTransform_x(n)))
            + this.spacing * (Math.floor(index / 4) + 1)
  }

  GetClusterTransform_y(cluster: Cluster): number {
    let clusterOrdered: Cluster[] = this.SortClusters()

    let index = clusterOrdered.findIndex((c) => c.clusterName == cluster.clusterName)
    if (index == -1) {
      return -1;
    }

    if (index % 4 == 0 || index % 4 == 1 ) {
      return this.start_transform_y
    }

    return this.start_transform_y + Math.max(...cluster.topology.nodes.map((n: Node) => cluster.topology.GetNodeTransform_y(n))) 
           + this.spacing * (Math.floor(index / 4) + 1)
  }
}


let TableRow = {
  source: undefined,
  destination: undefined,
  cluster: undefined,
  value: undefined
}

export const SimplePanel: React.FC<Props> = ({ options, data, width, height, fieldConfig, id }) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  if (data.series.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }
  const dataSeries = data.series[0]
  // .map((dataFrame: DataFrame) => dataFrame.name.find((field) => field.type === 'number'))
  // .map((field) => field?.values.get(field.values.length - 1));
  let nodes: Node[] = []
  let edges: Edge[] = []

  console.log(data.series[0])
  dataSeries.length
  let clusterTopology = new Topology(200,-100,35)

  for (let j = 0; j < dataSeries.length ;j++) {
    let row = JSON.parse(JSON.stringify(TableRow))
    for (let i = 0; i < dataSeries.fields.length; i++) {
      let label = dataSeries.fields[i]
      if (j >= dataSeries.fields[i].values.length) {
        continue
      }
      let labelName: string = label.name
      row[labelName] = label.values[j]
    }
    if (!row.source) {
      continue
    }
    let sourceNode = new Node(row.source, row.cluster)
    let edge: Edge| undefined = new Edge(row.source, row.destination);
    if (!row.destionation || row.destination === "") {
      edge = undefined
    }

    let index = clusterTopology.clusters.findIndex((c) => c.clusterName == sourceNode.clusterName)
    let cluster: Cluster
    if (index == -1) {
      cluster = new Cluster(sourceNode.clusterName, new Topology(0,0,110))
      clusterTopology.clusters.push(cluster)
      cluster.topology.start_transform_x = clusterTopology.GetClusterTransform_x(cluster)
      cluster.topology.start_transform_y = clusterTopology.GetClusterTransform_y(cluster)
      cluster.topology.nodes = cluster.nodes
    }
    else {
      cluster = clusterTopology.clusters[index]
    }
    if (nodes.findIndex((node) => node.Equals(sourceNode)) == -1) {
      nodes.push(sourceNode)
      cluster.nodes.push(sourceNode)
    }
    if (edge && edges.findIndex((e) => e.Equals(edge)) == -1) {
      edges.push(edge)
      cluster.edges.push(edge)
    }
  }

  let color = theme.visualization.getColorByName(options.color);

  return (
    <div
      className={cx(
        styles.wrapper,
        css`
          width: ${width}px;
          height: ${height}px;
        `
      )}
    >
      <svg
        className={styles.svg}
        width={width}
        height={height}
        viewBox={`0 -${height / 2} ${width} ${height}`}
      >
        {
          clusterTopology.clusters.flatMap((cluster, clusterIndex) => 
            cluster.nodes.map((node, nodeIndex) => (
              <g
                key={`cluster-${clusterIndex}-node-${nodeIndex}`}
                fill={color}
              >
                <circle
                  r={30}
                  transform={`translate(${cluster.topology.GetNodeTransform_x(node)}, 
                                          ${cluster.topology.GetNodeTransform_y(node)})`}
                />
              </g>
            ))
          )
        }
      </svg>
      

      <div className={styles.textBox}>
        {options.showSeriesCount && (
          <div data-testid="simple-panel-series-counter">Number of series: {data.series.length}</div>
        )}
        <div>Text option value: {options.text}</div>
      </div>
    </div>
  );
};
