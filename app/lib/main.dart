// Platform glue: a full-screen WebView wired to ShellBridge. The logic it
// calls is unit-tested in test/shell_bridge_test.dart; this file only
// connects plugin callbacks and is proven on the device (DOCS-features.md).
// coverage:ignore-file
import 'package:google_account_token/google_account_token.dart' as gat;
import 'package:mahjong/shell_bridge.dart';
import 'package:material_ui/material_ui.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Google *Web* OAuth client id of kuhy-syncs: the ID-token audience
/// Firebase accepts. Public by design (also committed in kuhyx/todo).
const kServerClientId =
    '845446124781-prdoherj0v64vc6egvvcp3l0693khaur.apps.googleusercontent.com';

void main() => runApp(const MahjongApp());

/// The app: one screen holding the game site.
class MahjongApp extends StatelessWidget {
  /// Creates the app.
  const new({super.key});

  @override
  Widget build(BuildContext context) => const MaterialApp(
    debugShowCheckedModeBanner: false,
    home: ShellPage(),
  );
}

/// Full-screen WebView on [kHomeUrl].
class ShellPage extends StatefulWidget {
  /// Creates the page.
  const new({super.key});

  @override
  State<ShellPage> createState() => _ShellPageState();
}

class _ShellPageState extends State<ShellPage> {
  final _bridge = ShellBridge(
    tokenSource: () => gat.googleIdToken(serverClientId: kServerClientId),
  );
  late final WebViewController _web = WebViewController()
    ..setJavaScriptMode(JavaScriptMode.unrestricted)
    ..setBackgroundColor(const Color(0xFF16382B))
    ..setNavigationDelegate(
      NavigationDelegate(
        onNavigationRequest: (r) => _bridge.allows(r.url)
            ? NavigationDecision.navigate
            : NavigationDecision.prevent,
      ),
    )
    ..addJavaScriptChannel(kChannel, onMessageReceived: _onMessage)
    ..loadRequest(Uri.parse(kHomeUrl));

  Future<void> _onMessage(JavaScriptMessage m) async {
    final js = await _bridge.answer(m.message, await _web.currentUrl() ?? '');
    if (js != null) await _web.runJavaScript(js);
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, _) async {
      if (didPop) return;
      if (await _web.canGoBack()) {
        await _web.goBack();
      } else if (context.mounted) {
        await Navigator.of(context).maybePop();
      }
    },
    child: ColoredBox(
      color: const Color(0xFF16382B),
      child: SafeArea(child: WebViewWidget(controller: _web)),
    ),
  );
}
