import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    @Binding var url: URL?
    @Binding var isLoading: Bool
    @Binding var showWarning: Bool
    @Binding var warningMessage: String

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let contentController = WKUserContentController()

        // Add Script Message Handler for James
        contentController.add(context.coordinator, name: "jamesHandler")

        // JavaScript injection to read page text
        let jsSource = """
            (function() {
                var text = document.body.innerText || "";
                window.webkit.messageHandlers.jamesHandler.postMessage({
                    type: 'pageContent',
                    content: text.substring(0, 5000)
                });
            })();
        """
        let userScript = WKUserScript(source: jsSource, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        contentController.addUserScript(userScript)

        configuration.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if let url = url, webView.url != url {
            let request = URLRequest(url: url)
            webView.load(request)
        }
    }

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var parent: WebView

        init(_ parent: WebView) {
            self.parent = parent
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true
            parent.showWarning = false
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.isLoading = false

            // In case the url changed due to redirects, update binding
            if let currentUrl = webView.url {
                DispatchQueue.main.async {
                    self.parent.url = currentUrl
                }
            }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "jamesHandler" {
                guard let body = message.body as? [String: Any],
                      let type = body["type"] as? String,
                      type == "pageContent",
                      let content = body["content"] as? String else {
                    return
                }

                print("JamesBrowser received content length: \(content.count)")

                // Simulate mock AI check for MVP
                DispatchQueue.main.async {
                    if content.lowercased().contains("password") || content.lowercased().contains("login") {
                        self.parent.showWarning = true
                        self.parent.warningMessage = "James noticed something suspicious: Page requests sensitive information."
                    } else {
                        self.parent.showWarning = false
                    }
                }
            }
        }
    }
}
