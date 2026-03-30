import * as React from "react";
import Box from "@mui/material/Box";
import { DataGrid } from "@mui/x-data-grid";

export default function DataGridDemo({
  rows,
  columns,
  checkbox = false,
  pageSize,
}) {
  return (
    <Box sx={{ height: '50rem',  minWidth: "auto",  margin: "0 auto" }}>
      <DataGrid
        rows={rows}
        columns={columns}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: 10,
            },
          },
        }}
        pageSizeOptions={[10]}
        checkboxSelection={checkbox}
        disableRowSelectionOnClick
        autoPageSize
      />
    </Box>
  );
}
