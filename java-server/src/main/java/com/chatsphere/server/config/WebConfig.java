package com.chatsphere.server.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.io.File;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Point to the existing Express server's uploads folder so we reuse all avatars/files
        String uploadsPath = new File("../server/uploads/").getAbsolutePath();
        if (!uploadsPath.endsWith(File.separator)) {
            uploadsPath += File.separator;
        }
        
        // Ensure directories exist
        File dir = new File(uploadsPath);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        File avatarsDir = new File(dir, "avatars");
        if (!avatarsDir.exists()) {
            avatarsDir.mkdirs();
        }

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + uploadsPath);
    }
}
