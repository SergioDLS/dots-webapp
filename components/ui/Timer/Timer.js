import React, { Component } from 'react';

import './Timer.scss';

class  Timer extends Component {
  state = {
    seconds:null,
    classTimer:'Timer',
    timeout: null
  }

  componentDidMount(){

    this.setState({seconds:this.props.time});

  }

  componentWillUnmount () {
    this.props.unmount(this.state.seconds);

    clearTimeout(this.state.timeout);
  }

  shouldComponentUpdate (nextProps,nextState){
    return nextState.seconds !== this.state.seconds;
  }
  componentDidUpdate(){
    if(this.props.type === 'desc' ){

      if(this.state.seconds > this.props.limit){

        this.setState({timeout : setTimeout( () => {
          const seconds = this.state.seconds -1;

          if ((this.props.time - (this.props.time - this.state.seconds) ) < (this.props.time * 0.2)){
            this.setState({seconds:seconds,classTimer:'Timer animated pulse infinite'});
          }else{
            this.setState({seconds:seconds});
          }

        }, 1000)})

      }else{
        this.props.action("timeout");
      }
    }else{
      console.log("here");
      console.log(this.state.seconds, this.state.limit);
      if(this.state.seconds < this.props.limit){

        this.setState({timeout : setTimeout( () => {
          const seconds = this.state.seconds + 1;

          if ((this.props.time - (this.props.time - this.state.seconds) ) < (this.props.time * 0.2)){
            this.setState({seconds:seconds,classTimer:'Timer animated pulse infinite'});
          }else{
            this.setState({seconds:seconds});
          }

        }, 1000)})
      }else{
        this.props.action("timeout");
      }
    }
  }

  render(){




  return (<div className={this.state.classTimer}>{this.state.seconds}</div>);
  }
}

export default Timer;
