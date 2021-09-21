import dynamic from "next/dynamic";
import _ from "lodash";

const NoSSRForceGraph = dynamic(() => import("../lib/NoSSRForceGraph"), {
  ssr: false,
});
import { useQuery, useLazyQuery, gql } from "@apollo/client";
import { useState } from "react";

// if we alias the "id" field to "id" then we can
// construct a graph based on nesting, using the
// relationship field name as the link type (for text)
const mostRecentQuery = gql`
  {
    articles(options: { limit: 30, sort: { created: DESC } }) {
      __typename
      id
      url
      title
      created
      tags {
        __typename
        name
      }
      user {
        username
        avatar
        __typename
      }
    }
  }
`;

const moreArticlesQuery = gql`
  query articlesByTag($tag: String) {
    articles(
      where: { tags: { name: $tag } }
      options: { limit: 10, sort: { created: DESC } }
    ) {
      __typename
      id
      url
      title
      created
      tags {
        __typename
        name
      }
      user {
        username
        avatar
        __typename
      }
    }
  }
`;

const formatData = (data) => {
  // this could be generalized but let's leave that for another time

  const nodes = [];
  const links = [];

  if (!data.articles) {
    return;
  }

  data.articles.forEach((a) => {
    nodes.push({
      id: a.id,
      url: a.url,
      __typename: a.__typename,
      title: a.title,
    });

    links.push({
      source: a.user.username,
      target: a.id,
    });

    a.tags.forEach((t) => {
      nodes.push({
        id: t.name,
        __typename: t.__typename,
      });
      links.push({
        source: a.id,
        target: t.name,
      });
    });

    nodes.push({
      id: a.user.username,
      avatar: a.user.avatar,
      __typename: a.user.__typename,
    });
  });

  return {
    nodes: _.uniqBy(nodes, "id"),
    links,
  };
};

// sample data
const myData = {
  nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
  links: [
    { source: "a", target: "b" },
    { source: "c", target: "a" },
  ],
};

// load the most recent 10 articles, their topics, and who submitted them

export default function Home() {
  const { data } = useQuery(mostRecentQuery, {
    onCompleted: (data) => setGraphData(formatData(data)),
  });
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loadMoreArticles, { called, loading, data: newData }] = useLazyQuery(
    moreArticlesQuery,
    {
      onCompleted: (data) => {
        const newSubgraph = formatData(data);
        setGraphData({
          nodes: _.uniqBy([...graphData.nodes, ...newSubgraph.nodes], "id"),
          links: [...graphData.links, ...newSubgraph.links],
        });
      },
    }
  );
  console.log(data);
  console.log(data && formatData(data));

  return (
    <NoSSRForceGraph
      graphData={graphData}
      nodeLabel={(node) => {
        return node.id;
      }}
      //nodeAutoColorBy={"__typename"}
      //nodeRelSize={8}
      nodeCanvasObject={(node, ctx, globalScale) => {
        //console.log(node)
        // Interesting styling options:
        //  * highlight nodes: https://vasturiano.github.io/react-force-graph/example/highlight/
        //  * image nodes for avatars: https://vasturiano.github.io/react-force-graph/example/img-nodes/
        //  * click to expand/collapse nodes: https://vasturiano.github.io/react-force-graph/example/expandable-nodes/
        //  * fit graph to canvas: https://vasturiano.github.io/react-force-graph/example/fit-to-canvas/
        //  * Dynamic data: https://github.com/vasturiano/force-graph/blob/master/example/dynamic/index.html
        // * Text in links (reltypes) https://github.com/vasturiano/force-graph/blob/master/example/text-links/index.html

        if (node.__typename === "Tag") {
          //console.log(node);
          const label = node.id;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(
            (n) => n + fontSize * 0.2
          );
          ctx.fillStyle = `rgba(255, 255, 255, 0.8)`;
          ctx.fillRect(
            node.x - bckgDimensions[0] / 2,
            node.y - bckgDimensions[1] / 2,
            ...bckgDimensions
          );
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "red";
          //ctx.fillStyle = node.color;
          ctx.fillText(label, node.x, node.y);
          node.__bckgDimensions = bckgDimensions;
        } else if (node.__typename === "User") {
          const size = 12;
          const img = new Image();
          img.src = node.avatar;
          ctx.drawImage(img, node.x - size / 2, node.y - size / 2, size, size);
        } else if (node.__typename === "Article") {
          //console.log(node);
          const label = node.title;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(
            (n) => n + fontSize * 0.2
          );
          ctx.fillStyle = `rgba(255, 255, 255, 0.8)`;
          ctx.fillRect(
            node.x - bckgDimensions[0] / 2,
            node.y - bckgDimensions[1] / 2,
            ...bckgDimensions
          );
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "black";
          //ctx.fillStyle = node.color;
          ctx.fillText(label, node.x, node.y);
          node.__bckgDimensions = bckgDimensions;
        }
      }}
      nodePointerAreaPaint={(node, color, ctx) => {
        if (node.__typename === "Tag" || node.__typename === "Article") {
          ctx.fillStyle = color;
          const bckgDimensions = node.__bckgDimensions;
          bckgDimensions &&
            ctx.fillRect(
              node.x - bckgDimensions[0] / 2,
              node.y - bckgDimensions[1] / 2,
              ...bckgDimensions
            );
        } else {
          //else if (node.__typename === "User") {
          const size = 12;
          ctx.fillStyle = "black";
          ctx.fillRect(node.x - size / 2, node.y - size / 2, size, size);
        }
      }}
      onNodeClick={(node, event) => {
        console.log("Yo clicked me!");
        console.log(node);

        if (node.__typename === "Tag") {
          console.log("Lode more articles");
          loadMoreArticles({ variables: { tag: node.id } });
        } else if (node.__typename == "Article") {
          window.open(node.url, "_blank");
        }
      }}
    />
  );
}
