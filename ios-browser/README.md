# James Browser - iOS MVP

This directory contains the Swift/SwiftUI source files necessary for the James Browser MVP on iOS.

## Setup Instructions

Because this repository does not include an Xcode project file (`.xcodeproj`), you will need to create one manually on a macOS machine with Xcode installed.

1. Open Xcode and select **Create a new Xcode project**.
2. Choose **App** under iOS and click Next.
3. Enter `JamesBrowser` for the Product Name.
4. Ensure the Interface is set to **SwiftUI** and Language is **Swift**.
5. Save the project to a temporary location.
6. Replace the default `.swift` files in your new project with the ones provided in this repository (`JamesBrowserApp.swift`, `ContentView.swift`, `WebView.swift`).
7. Run the project in the iOS Simulator or on a physical device.

## Core Features
- Basic address bar for navigation
- WKWebView integration with JavaScript injection
- Mock "James" AI check that flags pages containing the words "login" or "password" and displays a warning overlay.