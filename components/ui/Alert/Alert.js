import React from 'react';
// temp edit to test patch
import Modal from  '../Modal/Modal';
import Button from  '../button/button';
import Doty from  '../Doty/Doty';

import './Alert.scss';

const alert = (props) => {

    let alertContent = null;
    let pose =  null;
    let title = '';
    if(props.config.type === 'Danger'){
        pose = '05';
        title = 'Oh no!!';
    }else if(props.config.type === 'Warning'){
        pose = '07'
        title = 'Careful!';
    }else if(props.config.type === 'Info'){
        pose = '01';
        title = 'Info...';
    }else if(props.config.type === 'Success'){
        pose = '02'
        title = 'Success!';
    }

  if(props.show){
    alertContent = (
    <Modal click={props.config.click}> 
        <div className="Alert">
            <h1 className="Alert__title">{title}</h1>  
            <Doty pose={pose} size="small"  customClass="Alert__doty animated tada" />
            <h5 className="Alert__message">{props.config.message}</h5>
            <div className="Alert__buttons"> 
                <Button click={props.config.accept} >accept</Button>
                
                {
                props.config.cancel ?
                <Button click={props.config.cancel} >cancel</Button>
                :
                null
                }  
                   
            </div>  
            
        </div>     
    </Modal>
    )

  }
  return (
    alertContent
  );
}

export default alert;
