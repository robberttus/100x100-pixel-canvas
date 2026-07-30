export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // 1. Is het de hoofdpagina (sonck.eu/)?
      if (url.pathname === "/") {
        // Dubbelcheck of ASSETS echt bestaat voordat we fetch aanroepen
        if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
          return env.ASSETS.fetch(request);
        }
        // Noodoplossing als ASSETS leeg is
        return new Response("<h1>Welkom op sonck.eu</h1>", {
          headers: { "content-type": "text/html;charset=UTF-8" },
        });
      }

      // 2. Voor alle andere pagina's (sonck.eu/*): stuur direct door!
      const doelUrl = `https://robbesonck.be/sonckeu${url.pathname}${url.search}`;
      return Response.redirect(doelUrl, 301);

    } catch (error) {
      // Dit vangt toekomstige fouten op zodat je geen Error 1101 meer krijgt
      return new Response("Foutje in de Worker code: " + error.message, { 
        status: 500,
        headers: { "content-type": "text/html;charset=UTF-8" }
      });
    }
  }
};
