import React from "react";
import { Switch, Route } from "react-router-dom";
import "./assets/css/style.css";
import "./App.css";
import Home from "./pages/home";
import Settings from "./pages/Settings";
import Error from "./pages/Error";


const PublicRoutes = () => {
  return (
    <Route>
      <Switch>
        <Route exact path="/" component={Home} />
        <Route path="/settings" component={Settings} />
        <Route component={Error} />
      </Switch>
    </Route>
  );
};

export default PublicRoutes;
