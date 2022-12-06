import React from "react";
import { Switch, Route } from "react-router-dom";
import Home from "./containers/home/home";
import Error from "./pages/Error";

const PublicRoutes = () => {
  return (
    <Route>
      <Switch>
        <Route path="" component={Home} />
        <Route component={Error} />
      </Switch>
    </Route>
  );
};

export default PublicRoutes;
