import React from 'react';

// use public images
const left = '/images/Arrow/left.png';
const right = '/images/Arrow/right.png';
const up = '/images/Arrow/up.png';
const down = '/images/Arrow/down.png';

import './Arrow.scss';

const arrow = (props) => {

  let src;

  switch (props.direction) {
    case "left":
      src = left;
    break;
    case "right":
      src = right;
    break;
    case "up":
      src = up;
    break;
    case "down":
      src = down;
    break;
    default: src = down;

  }
  return (
    <img onClick={props.click} className="Arrow" src={src} alt="arrow" />
  );
}

export default arrow;
