import React from 'react';

import './H.scss';

const h = (props) => {
  let header = null;

  switch (props.type) {
    case "1":
      header = <h1 className={"header header-primary "+props.customClass}>{props.children}</h1>;
    break;
    case "2":
      header = <h2 className={"header header-secondary "+props.customClass}>{props.children}</h2>;
    break;
    case "3":
      header = <h3 className={"header header-tertiary "+props.customClass}>{props.children}</h3>;
    break;
    case "4":
      header = <h4 className={"header header-fourthiary "+props.customClass}>{props.children}</h4>;
    break;
    case "5":
      header = <h5 className={"header header-fifthiary "+props.customClass}>{props.children}</h5>;
    break;
    default:
      header = <h5 className={"header header-fifthiary "+props.customClass}>{props.children}</h5>;

  }

  return(
    <>
      {header}
    </>
  );
}

export default h;
