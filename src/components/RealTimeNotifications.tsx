'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Check, AlertCircle, TrendingUp, Shield, Zap } from 'lucide-react';
import { useTrading } from '../contexts/TradingContext';

export function RealTimeNotifications() {
  const { notifications, markNotificationRead, clearNotifications, getUnreadNotifications } = useTrading();
  const [isOpen, setIsOpen] = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  const unreadNotifications = getUnreadNotifications();
  const unreadCount = unreadNotifications.length;

  // Show badge when new notifications arrive
  useEffect(() => {
    if (unreadCount > 0) {
      setShowBadge(true);
    } else {
      setShowBadge(false);
    }
  }, [unreadCount]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <Shield className="w-4 h-4" />;
      case 'trade':
        return <TrendingUp className="w-4 h-4" />;
      case 'system':
        return <Zap className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (severity: string) => {
    switch (severity) {
      case 'success':
        return 'text-green-400 border-green-500/20 bg-green-500/10';
      case 'warning':
        return 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10';
      case 'error':
        return 'text-red-400 border-red-500/20 bg-red-500/10';
      default:
        return 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10';
    }
  };

  const handleMarkRead = (notificationId: string) => {
    markNotificationRead(notificationId);
  };

  const handleClearAll = () => {
    clearNotifications();
    setIsOpen(false);
  };

  // Auto-close old notifications
  useEffect(() => {
    const autoCloseTimer = setTimeout(() => {
      const oldNotifications = notifications.filter(
        n => Date.now() - n.timestamp > 10000 && !n.read
      );
      oldNotifications.forEach(n => markNotificationRead(n.id));
    }, 1000);

    return () => clearTimeout(autoCloseTimer);
  }, [notifications, markNotificationRead]);

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-white/5 backdrop-blur-md border border-cyan-500/20 hover:bg-white/10 transition-all duration-300 group"
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-cyan-400 animate-pulse' : 'text-white/70'} group-hover:text-cyan-400 transition-colors`} />
        
        {/* Unread Badge */}
        <AnimatePresence>
          {showBadge && unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Notifications Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute top-full right-0 mt-2 w-80 sm:w-96 max-h-96 bg-gradient-to-b from-[#0a0118] to-[#1a0b2e] border border-cyan-500/20 rounded-lg shadow-2xl backdrop-blur-md z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-cyan-500/20">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white text-sm">Live Updates</span>
                {unreadCount > 0 && (
                  <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-white/50 hover:text-white transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length > 0 ? (
                <div className="p-2 space-y-2">
                  {notifications.slice(0, 20).map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-lg border transition-all duration-300 cursor-pointer hover:bg-white/5 ${
                        notification.read 
                          ? 'opacity-60 border-white/10 bg-white/5' 
                          : getNotificationColor(notification.severity)
                      }`}
                      onClick={() => handleMarkRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${notification.read ? 'text-white/50' : ''}`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={`font-medium text-sm ${
                              notification.read ? 'text-white/70' : 'text-white'
                            }`}>
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse flex-shrink-0" />
                            )}
                          </div>
                          <p className={`text-xs mt-1 ${
                            notification.read ? 'text-white/50' : 'text-white/80'
                          }`}>
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-white/40">
                              {new Date(notification.timestamp).toLocaleTimeString()}
                            </span>
                            {notification.read && (
                              <Check className="w-3 h-3 text-green-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-white/30 mx-auto mb-3" />
                  <p className="text-white/50 text-sm">No notifications yet</p>
                  <p className="text-white/30 text-xs mt-1">
                    You'll see real-time updates here when you start trading
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-cyan-500/20 p-3 bg-white/5">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>{notifications.length} total notifications</span>
                  <span>Real-time updates active</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notifications for Latest Updates */}
      <div className="fixed top-20 right-4 z-[60] space-y-2 pointer-events-none">
        <AnimatePresence>
          {unreadNotifications.slice(0, 3).map((notification) => (
            <motion.div
              key={`toast-${notification.id}`}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              className={`p-3 rounded-lg border max-w-sm pointer-events-auto cursor-pointer backdrop-blur-md ${getNotificationColor(notification.severity)}`}
              onClick={() => {
                handleMarkRead(notification.id);
                setIsOpen(true);
              }}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-white">
                    {notification.title}
                  </h4>
                  <p className="text-xs mt-1 text-white/80 line-clamp-2">
                    {notification.message}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkRead(notification.id);
                  }}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}