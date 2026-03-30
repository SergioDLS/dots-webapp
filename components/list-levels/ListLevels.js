import React, { Component } from 'react';
import axios from 'axios';
import { NavLink } from 'react-router-dom';

import Spinner from '../../../components/UI/Spinner/Spinner';
import H from '../../../components/UI/H/H';
import Arrow from '../../../components/UI/Arrow/Arrow';
import Modal from '../../../components/UI/Modal/Modal';
import WordImg from '../../../components/UI/WordImg/WordImg';
import Doty from '../../../components/UI/Doty/Doty';
import GoBack from '../../../components/UI/GoBack/GoBack';

import './ListLevels.scss';

class ListLevels extends Component {
  state = {
    levels: null,
    section:0,
    difficulty: null,
    lesson:null,
    modal: false,
    title:null
  }

  showModalHandler = (lesson,title) => {
      this.setState({modal:true,lesson:lesson,title:title})
  }


  componentDidMount () {

    const params = new URLSearchParams(this.props.location.search);
    const id = params.get('difficulty'); // bar
    let data = {
      id: id
    }
    this.setState({difficulty:id});
    axios.post("/getLevels",data)
    .then(response => {
      this.setState({levels:response.data[0]});
      console.log(response);
    })
    .catch(error => {
      console.log(error);
    })
  }

  changeSectionHandler = (operator) => {
    if((this.state.section !== 0 && operator === -1) || (this.state.section !== (this.state.levels.levels.length -1) && operator === 1)){
      const newValue = this.state.section + operator;
        this.setState({section:newValue});
        console.log(this.state);
    }
  }
  render(){
    let levels = <Spinner />
    if(this.state.levels){
      const bubbles = this.state.levels.levels[this.state.section].subLevels.map(bubble => {
        let content = null;
        if(bubble.under_construction === 1){
          content = (
              <div key={bubble.id} className="ListLevels__level">
                <WordImg src={bubble.src} size="ListLevels__img"/>
                <span className="ListLevels__name">{bubble.name}</span>
                <div className="ListLevels__coming-soon">Coming soon!</div>
              </div>
        );
      }else{
        content = (
            <div key={bubble.id} className="ListLevels__level" onClick={() => {this.showModalHandler(bubble.id,bubble.name)}}>
              <WordImg src={bubble.src} size="ListLevels__img"/>
              <span className="ListLevels__name">{bubble.name}</span>
            </div>
      );
      }
        return (
          <>{content}</>
        );
      })

      levels = (
        <>
          <div className="ListLevels__selector">
            <Arrow click={() => {this.changeSectionHandler(-1)}} direction="left"  />
            <H type="3">Level {this.state.section +1}</H>
            <Arrow click={() => {this.changeSectionHandler(1)}} direction="right"  />
          </div>
          <div className="ListLevels__bubbles animated bounceIn">
            {bubbles}
          </div>
        </>
      );
    }
    let modal = null;
    if(this.state.modal){
      modal = (
        <Modal click={() => {this.setState({modal:false})}}>
          <H type="2" customClass="header__dark">{this.state.title}</H>

          <div className="ListLevels__activities">
            <NavLink activeClassName="link" to={this.props.location.pathname+"/activities?lesson=" + this.state.lesson+'&difficulty='+this.state.difficulty+'&activity=1'} >
              <div className="ListLevels__activity" onClick="">
                <Doty pose="01" size="small" />
                <span className="ListLevels__activity-name">Spelling</span>
              </div>
            </NavLink>
            <NavLink  to={this.props.location.pathname+"/activities?lesson=" + this.state.lesson+'&difficulty='+this.state.difficulty+'&activity=3'} >
              <div className="ListLevels__activity">
                <Doty pose="02" size="small" />
                <span className="ListLevels__activity-name">Practice!</span>
              </div>
            </NavLink>
            </div>

        </Modal>
      );
    }
    console.log(this.props);
    return (
      <div className="ListLevels ">
        <GoBack to="/Levels" />
        <H type="1">Choose your Level</H>
          {levels}
          {modal}
          </div>
          );
  }
}

export default ListLevels;
