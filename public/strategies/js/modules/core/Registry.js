const Registry = {
  _widgets: {},
  _services: {},

  registerService(name, service) {
    Registry._services[name] = service;
  },

  registerWidget(name, widget) {
    Registry._widgets[name] = widget;
  },

  getService(name) {
    return Registry._services[name] || null;
  },

  getWidget(name) {
    return Registry._widgets[name] || null;
  },

  allWidgets() {
    return { ...Registry._widgets };
  },
};

export { Registry };
