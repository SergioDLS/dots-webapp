import React, { useState } from "react";
import { Link } from "react-router-dom";

import Doty from "../Doty/Doty";

import "./GoBack.scss";
import { Undo } from "@mui/icons-material";
import { Box } from "@mui/material";

export default function GoBack({to}) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      to={to}
    >
      <Box
        sx={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          margin: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          scale: hover ? "1.1" : "1"
        , transition:"all .2s ease"
        }}
      >
        <Doty pose="01" size="mini" />
        <Undo />
      </Box>
    </Link>
  );
}
