'use strict';

const { EventEmitter } = require('events');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * SSE hub. In-process pub/sub with a bounded subscriber list.
 * For multi-process, swap the emitter for Redis pub/sub — same interface.
 */
const emitter = new EventEmitter();
emitter.setMaxListeners(config.SSE_MAX_CLIENTS + 10);

const subscribers = new Set();

/** @returns {ReadableStream} */
function subscribe() {
  if (subscribers.size >= config.SSE_MAX_CLIENTS) {
    // Evict the oldest subscriber to make room. Better than refusing the new one.
    const [oldest] = subscribers;
    if (oldest) oldest.close();
  }

  const encoder = new TextEncoder();
  let heartbeat;
  let controllerRef;
  let listener;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      const send = (chunk) => {
        try { controller.enqueue(encoder.encode(chunk)); }
        catch { /* stream may have been closed by the client */ }
      };
      // Initial hello frame — makes some proxies flush the response.
      send(`: connected ${new Date().toISOString()}\n\n`);

      listener = (event, data) => {
        send(`event: ${event}\n`);
        send(`data: ${JSON.stringify(data)}\n\n`);
      };
      emitter.on('event', listener);

      heartbeat = setInterval(() => send(': keep-alive\n\n'), config.SSE_HEARTBEAT_MS);

      const wrapped = {
        close() {
          if (heartbeat) clearInterval(heartbeat);
          if (listener) emitter.off('event', listener);
          subscribers.delete(wrapped);
          try { controller.close(); } catch { /* already closed */ }
        },
      };
      subscribers.add(wrapped);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (listener) emitter.off('event', listener);
      // Find and remove the wrapped subscriber tied to this controller.
      for (const sub of subscribers) {
        if (sub._controller === controllerRef) subscribers.delete(sub);
      }
    },
  });

  return stream;
}

function publish(event, data) {
  try {
    emitter.emit('event', event, data);
    logger.debug('event published', { event, subscribers: subscribers.size });
  } catch (err) {
    logger.warn('publish failed', { message: err.message });
  }
}

function subscriberCount() {
  return subscribers.size;
}

module.exports = { subscribe, publish, subscriberCount };
