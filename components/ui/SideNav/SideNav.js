import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Doty from "../Doty/Doty";
import Backdrop from "../BackDrop/BackDrop";

import "./SideNav.scss";
import { Box, Stack, Typography, Button } from "@mui/material";
import { Edit } from "@mui/icons-material";
import { updateProfilePictureService } from "../../../services/user.service";
import { BASE_URL_IMAGES } from "../../../constants";

const user = JSON.parse(localStorage.getItem("user"));
export default function SideNav() {
  const [sideNav, setSideNav] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [isHovering, setIsHovering] = useState(false);
  useEffect(() => {
    if (user.id > 0 && user.profile_pic !== "") {
      console.log("sets", BASE_URL_IMAGES + "/users/" + user.profile_pic);
      setCurrentPhoto(BASE_URL_IMAGES + "/users/" + user.profile_pic);
    }
  }, [user]);

  const toggleSideNavHandler = () => {
    if (sideNav) {
      setSideNav(false);
    } else {
      setSideNav(true);
    }
  };

  const logOutHandler = () => {
    localStorage.removeItem("user");

    window.location.replace("/login");
  };

  const setProfilePhotoHandler = (file) => {
    if (user?.id > 0) {
      console.log("updates");
      setCurrentPhoto(URL.createObjectURL(file));
      updateProfilePictureService(user.id, file);
    }
  };

  let content = null;
  const profile = localStorage.getItem("profile");
  //console.log(profile);
  let admin = null;
  if (sideNav) {
    if (profile === "1") {
      admin = (
        <li className="SideNav__li">
          <Link className="SideNav__link" to="/admin">
            Admin
          </Link>
        </li>
      );
    }
    content = (
      <>
        <div className="SideNav animated slideInLeft">
          <div onClick={toggleSideNavHandler} className="SideNav__close">
            &larr;
          </div>

          <div
            className="SideNav__doty-container"
            style={{ marginBottom: "2rem", display: "flex" }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <Stack
              alignItems={"center"}
              justifyContent={"center"}
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "#ccc",
                transition: "all .2s",
                opacity: isHovering ? 0.8 : 0,
              }}
            >
              <Button component="label" height="100%" width="100%">
                <input
                  style={{ height: "100%", width: "100%" }}
                  hidden
                  accept="image/*"
                  type="file"
                  onChange={(event) => {
                    setProfilePhotoHandler(event.target.files[0]);
                  }}
                />
                <Typography variant="caption">Change profile photo</Typography>
                <Edit />
              </Button>
            </Stack>

            {currentPhoto ? (
              <img
                src={currentPhoto}
                title="profilepic"
                alt="profilepic"
                style={{ objectFit: "cover", width: "20rem" }}
              />
            ) : (
              <Doty pose="07" size="tiny" />
            )}
          </div>
          <Stack direction={"row"} alignItems={"center"}>
            <Doty pose="03" size="mini" />
            <Typography variant="h4" gutterBottom color={"white"}>
              {user.name}
            </Typography>
          </Stack>
          <br />
          <br />
          <br />
          <nav>
            <ul>
              {/*<li className="SideNav__li"><Link className="SideNav__link" to="/home">Home</Link></li>*/}
              <li className="SideNav__li">
                <Link className="SideNav__link" to="/levels">
                  Levels
                </Link>
              </li>
              <li className="SideNav__li">
                <Link className="SideNav__link" to="/readings">
                  Readings
                </Link>
              </li>
              <li className="SideNav__li">
                <Link className="SideNav__link" to="/games">
                  Games
                </Link>
              </li>
              {admin}
              <li
                onClick={logOutHandler}
                className="SideNav__li SideNav__logout"
              >
                <Link className="SideNav__link">Log Out</Link>
              </li>
            </ul>
          </nav>
        </div>
        <Backdrop click={toggleSideNavHandler} />
      </>
    );
  } else {
    content = (
      <>
        <div onClick={toggleSideNavHandler} className="SideNav__mini">
          <Doty pose="01" size="smaller" />
          Menu
        </div>
        <div onClick={toggleSideNavHandler} className="SideNav__hamburger">
          <i className="material-icons ">menu</i>
        </div>
      </>
    );
  }
  return <>{content}</>;
}
