import NextAuth, { customFetch } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      checks: ["pkce", "state"],
      authorization: { params: { prompt: "login" } },
      [customFetch](input, init) {
        const discoveryUrl = process.env.AUTH_KEYCLOAK_WELL_KNOWN;
        const requestUrl = input instanceof Request ? input.url : input.toString();
        const issuer = process.env.AUTH_KEYCLOAK_ISSUER;

        if (
          discoveryUrl &&
          requestUrl === `${issuer}/.well-known/openid-configuration`
        ) {
          return fetch(discoveryUrl, init);
        }

        return fetch(input, init);
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account }) {
      if (account?.provider === "keycloak") {
        // Auth.jsのuser.idはログインごとに生成されるため、IdPの識別子を使う。
        token.sub = account.providerAccountId;
      }

      return token;
    },
    session({ session, token }) {
      if (typeof token.sub !== "string" || token.sub.length === 0) {
        throw new Error("The session subject is missing");
      }

      session.user.id = token.sub;

      return session;
    },
  },
});
