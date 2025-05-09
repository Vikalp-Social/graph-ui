"use client";

import React from "react";
import {BrowserRouter as Router, Routes, Route} from "react-router-dom";
import Login from "../routes/Login";
import Home from "../routes/Home";
import Profile from "../routes/Profile";
import  Search from "../routes/Search";
import StatusPage from "../routes/StatusPage";
import TagPage from "../routes/TagPage";
import { UserContextProvider } from "../context/UserContext";
import { ErrorProvider } from "../context/ErrorContext";
import Vikalp from "../routes/Vikalp";
import About from "../routes/About";
import FollowPage from "../routes/FollowPage";
import Users from "../routes/Users";
import GraphHome from "../routes/GraphHome";
import GraphProfile from "../routes/GraphProfile";

// App component contains all the routes of the application
function App() {
	const experience = localStorage.getItem("experience");
	const selectedExp = {
		1: "Classic",
	}
	if(!experience){
		localStorage.setItem("experience", 1);
		window.location.reload(false);
	}
	else if(!(experience in selectedExp)){
		alert("Invalid Experience Selected. Redirecting to Classic Experience");
		localStorage.setItem("experience", 1);
		window.location.reload(false);
	}
	const expMap = {
		"home": [Home],
		"profile": [Profile]
	}
	return (
		<>
			<UserContextProvider>	
				<ErrorProvider>
					<Router>
						<Routes>
							<Route exact path="/" Component={Login} />
							<Route exact path="/auth" Component={Login} />
							<Route exact path="/home" Component={GraphHome} />
							<Route exact path="/status/:id" Component={StatusPage} />
							<Route exact path="/profile/:id" Component={Profile} />
							<Route exact path="/profile/:id/:follow" Component={FollowPage} />
							<Route exact path="/search/:q" Component={Search} />
							<Route exact path="/tags/:name" Component={TagPage} />
							<Route exact path="/vikalp" Component={Vikalp} />
							<Route exact path="/about" Component={About} />
							<Route exact path="/users" Component={Users} />
							<Route path="*" element={<div>404</div>} />
						</Routes>
					</Router>
				</ErrorProvider>
			</UserContextProvider>
		</>
	);
}

export default App;
