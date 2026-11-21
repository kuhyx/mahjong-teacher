import 'package:flutter_test/flutter_test.dart';
import 'package:mahjong/shell_bridge.dart';

void main() {
  group('ShellBridge', () {
    var calls = 0;
    ShellBridge bridge({String? token = 'tok'}) => ShellBridge(
      tokenSource: () async {
        calls++;
        return token;
      },
    );

    setUp(() => calls = 0);

    test('home is the public site', () {
      expect(kHomeUrl, 'https://mahjong.kuhy.duckdns.org/');
    });

    test('navigation stays on the site origin', () {
      final b = bridge();
      expect(b.allows('https://mahjong.kuhy.duckdns.org/?x=1'), isTrue);
      expect(b.allows('https://mahjong.kuhy.duckdns.org/llms.txt'), isTrue);
      expect(b.allows('https://evil.example/'), isFalse);
      expect(b.allows('http://mahjong.kuhy.duckdns.org/'), isFalse);
      expect(b.allows('https://mahjong.kuhy.duckdns.org.evil.example/'), isFalse);
      expect(b.allows('not a url'), isFalse);
    });

    test('sign-in answers the page with the token as a JS string', () async {
      final js = await bridge().answer('signin', 'https://mahjong.kuhy.duckdns.org/');
      expect(js, 'window.mjNativeToken && window.mjNativeToken("tok")');
      expect(calls, 1);
    });

    test('a cancelled chooser answers null', () async {
      final js = await bridge(token: null).answer('signin', kHomeUrl);
      expect(js, 'window.mjNativeToken && window.mjNativeToken(null)');
    });

    test('quotes in a token cannot break out of the JS string', () async {
      final js = await bridge(token: 'a"b\\c').answer('signin', kHomeUrl);
      expect(js, r'window.mjNativeToken && window.mjNativeToken("a\"b\\c")');
    });

    test('an off-origin page gets nothing and no chooser opens', () async {
      expect(await bridge().answer('signin', 'https://evil.example/'), isNull);
      expect(calls, 0);
    });

    test('unknown messages are ignored', () async {
      expect(await bridge().answer('other', kHomeUrl), isNull);
      expect(calls, 0);
    });

    test('a token source error answers null', () async {
      final b = ShellBridge(tokenSource: () async => throw StateError('x'));
      final js = await b.answer('signin', kHomeUrl);
      expect(js, 'window.mjNativeToken && window.mjNativeToken(null)');
    });
  });
}
