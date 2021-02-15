import React from "react";
import { Switch, Route } from "react-router-dom";
import Home from "./containers/home/home";
import DataSelection from "./containers/dataSelection";
import Settings from "./pages/Settings";
import Error from "./pages/Error";


const PublicRoutes = () => {
  return (
    <Route>
      <Switch>
        <Route path="/data-selection" component={DataSelection} />
        <Route exact path="/" component={Home} />
        <Route path="/settings" component={Settings} />
        <Route component={Error} />
      </Switch>
    </Route>
  );
};

export default PublicRoutes;
