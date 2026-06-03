package com.chatsphere.server.config;

import com.corundumstudio.socketio.SocketIOServer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SocketIOConfig {

    @Value("${socketio.host}")
    private String host;

    @Value("${socketio.port}")
    private int port;

    @Bean
    public SocketIOServer socketIOServer() {
        com.corundumstudio.socketio.Configuration config = new com.corundumstudio.socketio.Configuration();
        config.setHostname(host);
        config.setPort(port);
        
        // Optimize WebSocket server options matching Node.js ping timeout settings
        config.setPingTimeout(60000);
        config.setPingInterval(25000);
        
        // CORS Settings
        config.setOrigin(null);

        SocketIOServer server = new SocketIOServer(config);
        
        // Start server automatically
        server.start();
        System.out.println("[SocketIOConfig] Netty Socket.IO Server started on " + host + ":" + port);
        
        // Clean shutdown hook
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("[SocketIOConfig] Stopping Netty Socket.IO Server...");
            server.stop();
        }));

        return server;
    }
}
