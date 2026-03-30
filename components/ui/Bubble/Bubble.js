import React from 'react';


import './Bubble.scss';

const bubble = (props) => {
  let styleClass = ["Bubble"];
  if(props.size){
    styleClass[1] = props.size;
  }
  let blackHover = null;
  if(props.hover && props.hoverText){
      blackHover = (<div className="blackHover">props.hoverText</div>)
  }
  return (
    <div onClick={props.click} className={styleClass.join(' ')}>
      {blackHover}
      {props.children}
      {props.title}
    </div>
  );
}

export default bubble;
