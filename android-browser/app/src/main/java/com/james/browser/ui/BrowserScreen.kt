package com.james.browser.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.util.Log
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun BrowserScreen() {
    var urlText by remember { mutableStateOf("https://example.com") }
    var currentUrl by remember { mutableStateOf("https://example.com") }
    var showWarning by remember { mutableStateOf(false) }
    var warningMessage by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }

    val coroutineScope = rememberCoroutineScope()

    Column(modifier = Modifier.fillMaxSize()) {
        // Address Bar
        TopAppBar(
            title = {
                TextField(
                    value = urlText,
                    onValueChange = { urlText = it },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
                    keyboardActions = KeyboardActions(
                        onGo = {
                            var newUrl = urlText
                            if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
                                newUrl = "https://$newUrl"
                            }
                            currentUrl = newUrl
                            showWarning = false
                        }
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Color.Black,
                titleContentColor = Color.White
            )
        )

        // Web Content
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            AndroidView(
                factory = { context ->
                    WebView(context).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true

                        // Add Javascript Interface for James
                        addJavascriptInterface(
                            JamesJavascriptInterface { textData ->
                                // Simulate mock AI check in background
                                coroutineScope.launch(Dispatchers.Main) {
                                    if (textData.contains("password", ignoreCase = true) ||
                                        textData.contains("login", ignoreCase = true)) {
                                        // Mock basic scam detection for MVP
                                        showWarning = true
                                        warningMessage = "James noticed something suspicious: Page requests sensitive information."
                                    } else {
                                        showWarning = false
                                    }
                                }
                            },
                            "JamesAndroid"
                        )

                        webViewClient = object : WebViewClient() {
                            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                super.onPageStarted(view, url, favicon)
                                isLoading = true
                                url?.let { urlText = it }
                                showWarning = false // Reset warning on new load
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                super.onPageFinished(view, url)
                                isLoading = false

                                // Inject JavaScript to extract page text and send it to our interface
                                val jsInjection = """
                                    javascript:(function() {
                                        var text = document.body.innerText || "";
                                        window.JamesAndroid.receivePageContent(text.substring(0, 5000));
                                    })();
                                """.trimIndent()
                                view?.evaluateJavascript(jsInjection, null)
                            }
                        }

                        webChromeClient = WebChromeClient()
                        loadUrl(currentUrl)
                    }
                },
                update = { webView ->
                    if (webView.url != currentUrl) {
                        webView.loadUrl(currentUrl)
                    }
                }
            )

            // Loading Indicator
            if (isLoading) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }

            // Warning Overlay
            if (showWarning) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.8f)),
                    contentAlignment = Alignment.Center
                ) {
                    Card(
                        modifier = Modifier.padding(32.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White)
                    ) {
                        Column(
                            modifier = Modifier.padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = "Warning",
                                tint = Color.Red,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Suspicious Site Detected!",
                                style = MaterialTheme.typography.titleLarge
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(text = warningMessage)
                            Spacer(modifier = Modifier.height(24.dp))
                            Button(
                                onClick = { showWarning = false },
                                colors = ButtonDefaults.buttonColors(containerColor = Color.Black)
                            ) {
                                Text("I understand the risks, proceed", color = Color.White)
                            }
                        }
                    }
                }
            }
        }
    }
}

class JamesJavascriptInterface(private val onContentReceived: (String) -> Unit) {
    @JavascriptInterface
    fun receivePageContent(content: String) {
        Log.d("JamesBrowser", "Received content length: ${content.length}")
        onContentReceived(content)
    }
}
