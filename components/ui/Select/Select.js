import * as React from "react";
import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";

export default function BasicSelect({
  title = "",
  options = [],
  defaultValue = "",
  change = null,
}) {
  const handleChange = (event) => {
    change(event.target.value);
  };

  return (
    <Box sx={{ minWidth: 120 }}>
      <FormControl fullWidth>
        <InputLabel id="demo-simple-select-label">{title}</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="demo-simple-select"
          value={defaultValue}
          label="Age"
          onChange={handleChange}
        >
          {options.map((option) => {
            return (
              <MenuItem key={option.value} value={option.value}>
                {option.name}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    </Box>
  );
}
