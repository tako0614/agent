作りたいもの: AIでネットサービスらしきものを誰でも簡単に作れるサービス

TOP画面はChatGPTみたいなUIにする。
他のAIサービスとの差別化はAIだけですべてを完結して様々なサービスを利用できること。
特定の用途に特化したtoolsを提供する。
たとえば、予約tool、物販tool、フォームtoolみたいな用途が考えられるもの。
それらはすべてはAIで操作するが、markdown以外のAIの表現方法は提供するものとする。
apiはRESTful apiを提供する。どこからでもアクセスできる。
stripeで決済を行う。
AIはLangGraphを利用してmanusみたいな万能エージェントにする。

サーバーサイドはCloudflare Workers + Hono
DBはPostgreSQL + Prisma
フロントエンドはVite + SolidJS