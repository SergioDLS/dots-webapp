import React, { Component, useEffect, useRef, useState } from "react";

import "./Player.scss";
import { BASE_URL_SOUNDS } from "../../../constants";
import { Box, IconButton, Slider, Stack, Typography } from "@mui/material";
import {
  FastForwardRounded,
  FastRewindRounded,
  PauseRounded,
  PlayArrowRounded,
  SkipPrevious,
} from "@mui/icons-material";

export default function Player({ player, src }) {
  const [playing, setPlaying] = useState(false);
  //const [player, setPlayer] = useState(audio);
  const [currentTime, setCurrentTime] = useState(0);
  //const currentTime = useRef()
  //const audio = useRef();

  //const player = new Audio(BASE_URL_SOUNDS + "/" + src);

  useEffect(() => {
    player.addEventListener("timeupdate", () => {
      //console.log("currentTime", player.currentTime);
      let current = Math.round(player.currentTime);
      if (current > currentTime) {
        setCurrentTime(Math.round(player.currentTime));
      }
      if (player.currentTime === player.duration) {
        //player.pause();
        setCurrentTime(0);
        setPlaying(false);
      }
    });
  });

  useEffect(() => {
      if(player){
        player.play()
        player.pause()
      }
  },[player])

  useEffect(() => {
    playing ? player.play() : player.pause();

    return () => player.pause();
  }, [playing]);

  const formatDuration = (value) => {
    if (isNaN(value)) {
      return "0:00";
    }
    const minute = Math.floor(value / 60);
    const secondLeft = value - minute * 60;
    return `${minute}:${secondLeft < 10 ? `0${secondLeft}` : secondLeft}`;
  };

  return (
    <>
      <Stack width={550} maxWidth={"100%"} direction={"row"} justifyContent={"space-between"} alignItems={"center"} gap={2} padding={"1rem"} sx={{backgroundColor: "#e6e6fc", borderRadius: "1rem", margin:"1rem"}}>
        <IconButton
        
          aria-label={playing ? "pause" : "play"}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? (
            <PauseRounded color="primary" sx={{ fontSize: "3rem" }} />
          ) : (
            <PlayArrowRounded color="primary" sx={{ fontSize: "3rem" }} />
          )}
        </IconButton>
        <Stack direction={"row"} gap={1}>
          <Typography variant="h6" color={"primary"}>{formatDuration(currentTime)}</Typography>
          <Typography variant="h6" color={"primary"}>/</Typography>

          <Typography variant="h6" color={"primary"}>
            {formatDuration(Math.round(player.duration))}
          </Typography>
        </Stack>

        <Box width={300}>
          <Slider
            min={0}
            step={1}
            value={currentTime}
            max={Math.round(player.duration)}
            onChange={(_, value) => (player.currentTime = value)}
          />
        </Box>
      </Stack>

      {/*<audio src={BASE_URL_SOUNDS + "/" + src} ref={audio} />*/}
    </>
  );
}
