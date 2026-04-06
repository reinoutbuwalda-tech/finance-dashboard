import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Password",
      credentials: { password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        if (credentials?.password === process.env.DASHBOARD_PASSWORD) {
          return { id: "1", name: "Reinout", email: "reinout@buwalda.nl" }
        }
        return null
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
}
