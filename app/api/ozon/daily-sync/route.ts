// ============================================================
// CLUSTERS
// ============================================================

async function getOzonClusters() {

  const [
    ozonResponse,
    cisResponse,
  ] =
    await Promise.all(
      [
        ozonPost<{
          clusters?:
            OzonCluster[];
        }>(
          "/v1/cluster/list",
          {
            cluster_type:
              "CLUSTER_TYPE_OZON",
          }
        ),

        ozonPost<{
          clusters?:
            OzonCluster[];
        }>(
          "/v1/cluster/list",
          {
            cluster_type:
              "CLUSTER_TYPE_CIS",
          }
        ),
      ]
    );


  const clusters =
    [
      ...(
        ozonResponse.clusters
        ?? []
      ),

      ...(
        cisResponse.clusters
        ?? []
      ),
    ];


  const warehouseToCluster =
    new Map<
      string,
      WarehouseCluster
    >();


  for (
    const cluster
    of clusters
  ) {

    const clusterId =
      normalizeKey(
        cluster.id
      );


    const clusterName =
      normalizeKey(
        cluster.name
      );


    for (
      const logisticCluster
      of cluster.logistic_clusters
      ?? []
    ) {

      for (
        const warehouse
        of logisticCluster.warehouses
        ?? []
      ) {

        const warehouseId =
          normalizeKey(
            warehouse.warehouse_id
          );


        if (!warehouseId) {

          continue;

        }


        warehouseToCluster.set(
          warehouseId,
          {
            clusterId,

            clusterName,

            warehouseName:
              normalizeKey(
                warehouse.name
              ),
          }
        );

      }

    }

  }


  return {
    clusters,
    warehouseToCluster,
  };
}
