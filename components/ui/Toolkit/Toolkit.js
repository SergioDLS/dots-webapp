import React, { Component } from 'react';

import './Toolkit.scss';

class Toolkit extends Component {
  state={
    src:null
  }
  render(){
    let img =null;
    if(this.state.src){
      img = <img className="Toolkit__img" src={this.state.src} alt=""/>
    }
    return(
      <div className="Toolkit">
        <p className="Toolkit__paragraph">{this.props.desc}</p>
        {img}
      </div>
    )
  }
}

export default Toolkit;
