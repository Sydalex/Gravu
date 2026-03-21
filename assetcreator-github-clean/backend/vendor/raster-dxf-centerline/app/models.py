from pydantic import BaseModel, Field


class VectorizeResponse(BaseModel):
    width: int
    height: int
    export_mode: str = Field(description="Centerline geometry mode used for export")
    path_count: int = Field(description="Number of centerline stroke paths")
    svg_preview: str = Field(description="SVG preview markup")
    dxf_base64: str = Field(description="DXF text content as base64")


class GraphStatsResponse(BaseModel):
    endpoint_count: int
    junction_count: int
    edge_run_count: int
    merged_path_count: int
    spline_count: int
    polyline_count: int


class VectorizeDebugResponse(BaseModel):
    width: int
    height: int
    export_mode: str
    path_count: int
    graph_stats: GraphStatsResponse
    svg_preview: str
