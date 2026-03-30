import React from 'react';

import './Option.scss';

const option = (props) => {
  let classComp = "Option";
  if(props.margin){
    classComp = "Option Option__margin";
  }
  return(
    <div className={classComp} onClick={props.click}>{props.children}</div>
  );
}
export default option;
