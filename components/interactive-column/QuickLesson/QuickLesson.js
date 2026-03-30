import React, {Component} from 'react';
import Youtube from 'react-youtube';


import './QuickLesson.scss';

class QuickLesson extends Component {
  state = {
    levels: null,
    videos: ['04p5vewy57o','a9LSjJVXBcM','VZh-fpWtWFY','w7glSB5oDmU','mZfXVK3AXeU','O9UoV9vrMUo']
  }


  

  render(){
    let indexVideo = Math.floor(Math.random() * 10);
    if(indexVideo > 5){
      indexVideo = indexVideo -6;
    }
    console.log(indexVideo);
    let height = 0;
    let width = 0;
    const screenWidth = window.screen.width;
      console.log(screenWidth);

        height = '250';
        width = '250';

        if(screenWidth < 1500 ){
            height = '230';
            width = '230';
        }

    if(screenWidth < 1200 ){
        height = '200';
        width = '200';
    }
    const opts = {
          height: height,
          width: width,
          playerVars: {
            autoplay: 0,
          },
    };
    return (
      <div className="QuickLesson">
          Quick lesson!
          <Youtube videoId={this.state.videos[indexVideo]} opts={opts} onReady={this._onReady} />
      </div>
    );
  }

}

export default QuickLesson;
