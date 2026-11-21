/// The app's only logic: keep the WebView on the game site and answer the
/// page's sign-in request with a Google ID token.
///
/// Google blocks OAuth popups inside WebViews, so the page posts `signin` on
/// the `MahjongShell` channel and this class answers with JS that calls
/// `window.mjNativeToken(token | null)` (src/web/chat/native_signin.ts).
library;

import 'dart:convert';
import 'dart:developer';

/// The public game site the shell shows.
const kHomeUrl = 'https://mahjong.kuhy.duckdns.org/';

/// Name of the JavaScript channel the page posts to.
const kChannel = 'MahjongShell';

/// Returns a Google ID token, or null when the user cancels.
typedef TokenSource = Future<String?> Function();

/// Origin guard plus the sign-in message handler.
class ShellBridge {
  /// Creates a bridge that gets tokens from [tokenSource].
  new({required this.tokenSource});

  /// Where ID tokens come from (the system account chooser in the app).
  final TokenSource tokenSource;

  static final Uri _home = Uri.parse(kHomeUrl);

  /// Whether [url] is on the game site's exact origin.
  bool allows(String url) {
    final u = Uri.tryParse(url);
    return u != null &&
        u.scheme == _home.scheme &&
        u.host == _home.host &&
        u.port == _home.port;
  }

  /// JS to run in the page for [message] sent from [pageUrl], or null.
  ///
  /// Only the game site may ask: any other page the WebView might show gets
  /// nothing, so it can never obtain kuhy's ID token.
  Future<String?> answer(String message, String pageUrl) async {
    if (message != 'signin' || !allows(pageUrl)) return null;
    String? token;
    try {
      token = await tokenSource();
    } on Object catch (e) {
      log('Google sign-in failed: $e', level: 1000);
    }
    return 'window.mjNativeToken && window.mjNativeToken(${jsonEncode(token)})';
  }
}
