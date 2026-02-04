import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "../components/layout/Header";
import { NodeList } from "../components/nodes/NodeList";
import { AddNodeForm } from "../components/nodes/AddNodeForm";
import { fetchNodes } from "../api/client";

/** Page listing all monitored nodes with the ability to add new ones */
export function NodesPage() {
  const qc = useQueryClient();

  const { data: nodes = [] } = useQuery({
    queryKey: ["nodes"],
    queryFn: fetchNodes,
    refetchInterval: 10_000,
  });

  return (
    <>
      <Header title="Node Console" subtitle={`${nodes.length} Monitored Nodes`} />

      <div className="mb-6">
        <AddNodeForm onCreated={() => qc.invalidateQueries({ queryKey: ["nodes"] })} />
      </div>

      <NodeList nodes={nodes} />
    </>
  );
}
