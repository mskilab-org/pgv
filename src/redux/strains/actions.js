const actions = {
  GET_STRAINSLIST: "GET_STRAINSLIST",
  STRAINSLIST_RECEIVED: "STRAINSLIST_RECEIVED",
  GET_PHYLOGENY: "GET_PHYLOGENY",
  PHYLOGENY_RECEIVED: "PHYLOGENY_RECEIVED",

  getStrainsList: (file) => ({
    type: actions.GET_STRAINSLIST,
    file: file
  }),
  getPhylogeny: (file) => ({
    type: actions.GET_PHYLOGENY,
    file: file
  })
};

export default actions;
