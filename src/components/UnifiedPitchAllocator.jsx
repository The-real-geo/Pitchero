10:50:42 AM: Netlify Build                                                 
10:50:42 AM: ────────────────────────────────────────────────────────────────
10:50:42 AM: ​
10:50:42 AM: ❯ Version
10:50:42 AM:   @netlify/build 35.1.4
10:50:42 AM: ​
10:50:42 AM: ❯ Flags
10:50:42 AM:   accountId: 689ebedfc5c470817d4cb1a0
10:50:42 AM:   baseRelDir: true
10:50:42 AM:   buildId: 68ba3adad1347b0008d71541
10:50:42 AM:   deployId: 68ba3adad1347b0008d71543
10:50:42 AM: ​
10:50:42 AM: ❯ Current directory
10:50:42 AM:   /opt/build/repo
10:50:42 AM: ​
10:50:42 AM: ❯ Config file
10:50:42 AM:   /opt/build/repo/netlify.toml
10:50:42 AM: ​
10:50:42 AM: ❯ Context
10:50:42 AM:   branch-deploy
10:50:42 AM: ​
10:50:42 AM: Build command from Netlify app                                
10:50:42 AM: ────────────────────────────────────────────────────────────────
10:50:42 AM: ​
10:50:42 AM: $ npm run build
10:50:42 AM: > pitchero-app@0.1.0 build
10:50:42 AM: > react-scripts build
10:50:43 AM: Creating an optimized production build...
10:50:54 AM: Failed during stage 'building site': Build script returned non-zero exit code: 2 (https://ntl.fyi/exit-code-2)
10:50:54 AM: 
10:50:54 AM: Treating warnings as errors because process.env.CI = true.
10:50:54 AM: Most CI servers set it automatically.
10:50:54 AM: 
10:50:54 AM: Failed to compile.
10:50:54 AM: 
10:50:54 AM: [eslint]
10:50:54 AM: src/components/UnifiedPitchAllocator.jsx
10:50:54 AM:   Line 33:9:  'isLightColor' is assigned a value but never used  no-unused-vars
10:50:54 AM: ​
10:50:54 AM: "build.command" failed                                        
10:50:54 AM: ────────────────────────────────────────────────────────────────
10:50:54 AM: ​
10:50:54 AM:   Error message
10:50:54 AM:   Command failed with exit code 1: npm run build (https://ntl.fyi/exit-code-1)
10:50:54 AM: ​
10:50:54 AM:   Error location
10:50:54 AM:   In Build command from Netlify app:
10:50:54 AM:   npm run build
10:50:54 AM: ​
10:50:54 AM:   Resolved config
10:50:54 AM:   build:
10:50:54 AM:     command: npm run build
10:50:54 AM:     commandOrigin: ui
10:50:54 AM:     publish: /opt/build/repo/build
10:50:54 AM:     publishOrigin: config
10:50:54 AM:   redirects:
10:50:54 AM:     - from: /*
      status: 200
      to: /index.html
  redirectsOrigin: config
10:50:54 AM: Build failed due to a user error: Build script returned non-zero exit code: 2
10:50:54 AM: Failing build: Failed to build site
10:50:55 AM: Finished processing build request in 27.672s
