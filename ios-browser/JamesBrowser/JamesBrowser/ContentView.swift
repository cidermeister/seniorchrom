import SwiftUI
import WebKit

struct ContentView: View {
    @State private var urlString: String = "https://example.com"
    @State private var loadUrl: URL? = URL(string: "https://example.com")
    @State private var showWarning = false
    @State private var warningMessage = ""
    @State private var isLoading = false

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                // Address Bar
                HStack {
                    TextField("Enter URL", text: $urlString)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .disableAutocorrection(true)
                        .padding(10)
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                        .onSubmit {
                            loadSubmittedUrl()
                        }

                    Button(action: loadSubmittedUrl) {
                        Image(systemName: "arrow.right.circle.fill")
                            .foregroundColor(.black)
                            .font(.system(size: 24))
                    }
                }
                .padding()
                .background(Color.white)
                .shadow(color: .black.opacity(0.1), radius: 2, y: 2)

                if isLoading {
                    ProgressView()
                        .progressViewStyle(LinearProgressViewStyle(tint: .black))
                }

                // WebView Integration
                WebView(url: $loadUrl, isLoading: $isLoading, showWarning: $showWarning, warningMessage: $warningMessage)
                    .ignoresSafeArea(edges: .bottom)
            }

            // Warning Overlay
            if showWarning {
                Color.black.opacity(0.8)
                    .ignoresSafeArea()

                VStack(spacing: 20) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.red)
                        .font(.system(size: 60))

                    Text("Suspicious Site Detected!")
                        .font(.title2)
                        .fontWeight(.bold)

                    Text(warningMessage)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)

                    Button(action: {
                        showWarning = false
                    }) {
                        Text("I understand the risks, proceed")
                            .foregroundColor(.white)
                            .padding()
                            .background(Color.black)
                            .cornerRadius(10)
                    }
                }
                .padding(30)
                .background(Color.white)
                .cornerRadius(20)
                .shadow(radius: 10)
                .padding(40)
            }
        }
    }

    private func loadSubmittedUrl() {
        var newUrlString = urlString
        if !newUrlString.hasPrefix("http://") && !newUrlString.hasPrefix("https://") {
            newUrlString = "https://" + newUrlString
        }
        if let newUrl = URL(string: newUrlString) {
            urlString = newUrlString
            loadUrl = newUrl
            showWarning = false
        }
    }
}

#Preview {
    ContentView()
}
