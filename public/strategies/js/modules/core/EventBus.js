const EventBus = {
  _listeners: {},

  on(event, fn) {
    if (!EventBus._listeners[event]) EventBus._listeners[event] = [];
    EventBus._listeners[event].push(fn);
    return () => EventBus.off(event, fn);
  },

  off(event, fn) {
    const list = EventBus._listeners[event];
    if (list) EventBus._listeners[event] = list.filter(f => f !== fn);
  },

  emit(event, data) {
    const list = EventBus._listeners[event];
    if (list) list.forEach(fn => fn(data));
  },
};

export { EventBus };
