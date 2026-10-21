# Website GPU launcher

The earlier local-game fix launched Brave with `--use-angle=d3d11` and a dedicated `%LOCALAPPDATA%\BreachProtocol\GPUProfile` browser profile. `Play Website - GPU.cmd` applies the same launch configuration to `https://ximmiswsashed.github.io/connect.gg/`. Choose Breach Protocol from the existing website sidebar after signing in if required.

The launcher uses your installed Brave. It does not start a local game or lobby server, change normal-profile settings, disable browser protections, or install software. The profile has its own cookies and sign-in. A webpage cannot apply browser startup flags by itself, so download and run the launcher on Windows.

For an existing normal Brave profile, enable graphics acceleration in Settings > System and relaunch. If necessary, inspect `brave://gpu` and the ANGLE backend setting in `brave://flags`; choose Default or D3D11, not software WARP. In-game Settings > Display > Frame limit should be 240. Browser energy saving and the display refresh rate can impose additional limits.

References: https://support.brave.com/hc/en-us/articles/360044860011-How-Do-I-Use-Command-Line-Flags-in-Brave and https://support.brave.com/hc/en-us/articles/13383683902733-How-do-I-use-the-Memory-and-Energy-Saver-features-in-Brave
