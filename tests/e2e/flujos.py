"""Pruebas de punta a punta de Góndola en un navegador real (Chromium).

Recorre lo que haría una persona: cargar productos, vender con lector de códigos y por kilo,
deshacer, reponer con pedido por WhatsApp, recibir mercadería, aumentar precios, recuento,
copia de seguridad, restaurar, importar una planilla y abrir la app sin internet.

Uso:
  pip install playwright && playwright install chromium
  npm run dev            # en otra terminal
  python tests/e2e/flujos.py
"""
import tempfile
TMP = tempfile.mkdtemp()
import asyncio, json
from playwright.async_api import async_playwright
import os
B=os.environ.get("GONDOLA_URL","http://localhost:5173/")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": os.environ["CHROME"]} if os.environ.get("CHROME") else {}))
        ctx = await b.new_context(viewport={"width":1366,"height":900}, locale="es-AR", accept_downloads=True)
        await ctx.grant_permissions(["clipboard-read","clipboard-write"], origin=B.rstrip("/"))
        pg = await ctx.new_page()
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        t = lambda s: pg.locator(s).inner_text()
        await pg.goto(B); await pg.wait_for_timeout(500)
        # 1) Empezar de cero: cargar producto
        await pg.fill("#bv-nombre","Kiosco Mili")
        await pg.click("text=Cargar mis productos"); await pg.wait_for_timeout(400)
        print("1 ruta:", pg.url.split('#')[1])
        await pg.click("button[type=submit]")  # sin datos → error
        print("1 error nombre:", await t("#f-nombre-error"))
        await pg.fill("#f-nombre","Alfajor de chocolate"); await pg.fill("#f-categoria","Golosinas")
        await pg.fill("#f-codigo","7790001112223"); await pg.fill("#f-costo","500")
        print("1 precio auto (40%):", await pg.input_value("#f-precio"))
        await pg.fill("#f-stock","3"); await pg.fill("#f-minimo","5"); await pg.fill("#f-proveedor","Golosinas Norte")
        await pg.click("[data-otro]"); await pg.wait_for_timeout(300)
        await pg.fill("#f-nombre","Queso cremoso"); await pg.click("#f-categoria"); 
        await pg.click("button[role=radio][data-valor=kg]")
        await pg.fill("#f-categoria","Fiambrería"); await pg.fill("#f-costo","7000"); await pg.fill("#f-ganancia","45")
        print("1 precio queso:", await pg.input_value("#f-precio"))
        await pg.fill("#f-stock","2,5"); await pg.fill("#f-minimo","1")
        await pg.click("button[type=submit]"); await pg.wait_for_timeout(400)
        print("1 tras guardar:", pg.url.split('#')[1], "|", await t("#productos-cuenta"))
        # Código duplicado
        await pg.goto(B+"#/productos/nuevo"); await pg.fill("#f-nombre","Otro"); await pg.fill("#f-codigo","7790001112223"); await pg.fill("#f-precio","100")
        await pg.click("button[type=submit]"); await pg.wait_for_timeout(200)
        print("1 código repetido:", await t("#f-codigo-error"))
        # 2) Vender con lector (código + Enter) y por kilo con monto en pesos
        await pg.goto(B+"#/vender"); await pg.wait_for_timeout(300)
        await pg.fill("#caja-buscar","7790001112223"); await pg.press("#caja-buscar","Enter")
        await pg.fill("#caja-buscar","7790001112223"); await pg.press("#caja-buscar","Enter")
        await pg.fill("#caja-buscar","queso"); await pg.press("#caja-buscar","Enter"); await pg.wait_for_timeout(200)
        await pg.fill("#peso-pesos","5000"); print("2 kg calculados:", await pg.input_value("#peso-kg"))
        await pg.click("text=Agregar al ticket"); await pg.wait_for_timeout(200)
        print("2 ticket:", (await t("#ticket-items")).replace("\n"," | "))
        print("2 total:", await t("#ticket-total"))
        await pg.click("#ticket-sugeridos button >> nth=1"); print("2 vuelto:", await t("#ticket-vuelto"))
        await pg.keyboard.press("Control+Enter"); await pg.wait_for_timeout(300)
        print("2 aviso:", await t(".aviso >> nth=-1"))
        await pg.goto(B+"#/productos"); await pg.wait_for_timeout(200)
        print("2 stock tras venta:", (await t("#productos-filas")).replace("\n"," | ")[:200])
        # Vender más de lo que hay → advertencia
        await pg.goto(B+"#/vender"); await pg.wait_for_timeout(200)
        await pg.fill("#caja-buscar","alfajor"); await pg.press("#caja-buscar","Enter")
        await pg.fill(".ticket__cantidad","4"); await pg.press(".ticket__cantidad","Tab")
        await pg.click("label.medio:has-text('QR')"); await pg.click("#ticket-cobrar"); await pg.wait_for_timeout(200)
        print("2 sin stock dialog:", await t("dialog h2"))
        await pg.click("dialog >> text=Cobrar igual"); await pg.wait_for_timeout(300)
        # Deshacer
        await pg.click(".aviso >> text=Deshacer"); await pg.wait_for_timeout(300)
        print("2 tras deshacer ticket:", (await t("#ticket-items")).replace("\n"," | "))
        await pg.click("#ticket-vaciar")
        # 3) Reponer y pedido por WhatsApp
        await pg.goto(B+"#/reponer"); await pg.wait_for_timeout(300)
        print("3 reponer:", (await t("#vista")).replace("\n"," | ")[:260])
        await pg.fill("input[type=tel]","11 5555-1234"); await pg.press("input[type=tel]","Tab"); await pg.wait_for_timeout(200)
        href = await pg.locator(".boton--whatsapp").first.get_attribute("href")
        await pg.locator(".boton--whatsapp").first.dispatch_event("click")
        href = await pg.locator(".boton--whatsapp").first.get_attribute("href")
        import urllib.parse as u; print("3 whatsapp:", href.split('?')[0], "|", u.unquote(href.split('text=')[1])[:160].replace("\n"," / "))
        await pg.click("text=Llegó el pedido"); await pg.wait_for_timeout(200)
        await pg.click("dialog >> text=Sumar al stock"); await pg.wait_for_timeout(300)
        print("3 tras recibir:", (await t("#vista")).replace("\n"," | ")[:120])
        # 4) Aumento de precios
        await pg.goto(B+"#/productos"); await pg.click("text=Aumentar precios"); await pg.fill("#aum-pct","10"); await pg.wait_for_timeout(100)
        print("4 vista previa:", (await t(".vista-previa")).replace("\n"," | ")[:160])
        await pg.click("dialog >> text=Aplicar aumento"); await pg.wait_for_timeout(300)
        # 5) Historial del producto + recuento
        await pg.click("text=Alfajor de chocolate"); await pg.wait_for_timeout(300)
        await pg.click("text=Recuento"); await pg.fill("#mov-cantidad","20"); await pg.click("dialog >> text=Guardar"); await pg.wait_for_timeout(300)
        print("5 historial:", (await t(".historial")).replace("\n"," | ")[:300])
        # 6) Persistencia tras recargar
        await pg.reload(); await pg.wait_for_timeout(600)
        print("6 tras recargar:", await t(".tarjeta-stock__cifra"), "| ventas:", await pg.evaluate("1"))
        # 7) Copia de seguridad: descargar y restaurar
        await pg.goto(B+"#/ajustes"); await pg.wait_for_timeout(300)
        async with pg.expect_download() as d: await pg.click("text=Descargar copia")
        dl = await d.value; path=os.path.join(TMP, "copia.json"); await dl.save_as(path)
        data=json.load(open(path)); print("7 copia:", data["app"], len(data["productos"]), "productos,", len(data["ventas"]), "ventas", dl.suggested_filename)
        # Exportar CSV
        async with pg.expect_download() as d: await pg.click("text=Exportar productos")
        dl = await d.value; await dl.save_as(os.path.join(TMP, "productos.csv")); print("7 csv:", open(os.path.join(TMP, "productos.csv"),encoding="utf-8-sig").read().splitlines()[:3])
        # Borrar todo y restaurar
        await pg.click("text=Borrar todos los datos"); await pg.fill("#borrar-confirmar","borrar"); await pg.click("dialog .boton--peligro"); await pg.wait_for_timeout(1200)
        print("7 tras borrar:", pg.url.split('#')[1])
        await pg.goto(B+"#/ajustes"); await pg.wait_for_timeout(300)
        async with pg.expect_file_chooser() as fc: await pg.click("text=Restaurar una copia")
        await (await fc.value).set_files(path); await pg.wait_for_timeout(300)
        print("7 confirmar:", (await t("dialog p")).strip()[:120])
        await pg.click("dialog >> text=Reemplazar con la copia"); await pg.wait_for_timeout(500)
        await pg.goto(B+"#/productos"); await pg.wait_for_timeout(300); print("7 tras restaurar:", await t("#productos-cuenta"))
        # 8) Importar planilla
        open(os.path.join(TMP, "planilla.csv"),"w",encoding="utf-8").write("Producto;Rubro;Precio de venta;Costo;Cantidad;Mínimo;Proveedor\nYerba 1 kg;Almacén;4.190;3.100;12;6;Distri Sur\nAzúcar 1 kg;Almacén;1.330;980;18;8;Distri Sur\nQueso cremoso;Fiambrería;11000;7000;3;1;Lácteos\n")
        await pg.goto(B+"#/ajustes"); await pg.wait_for_timeout(200)
        async with pg.expect_file_chooser() as fc: await pg.click("text=Importar planilla")
        await (await fc.value).set_files(os.path.join(TMP, "planilla.csv")); await pg.wait_for_timeout(300)
        print("8 importar:", (await t("dialog h2")), "|", (await t("dialog .dialogo__cuerpo p")).strip()[:140])
        await pg.click("dialog >> button:has-text('Importar')"); await pg.wait_for_timeout(400)
        print("8 aviso:", await t(".aviso >> nth=-1"))
        # 9) Offline: service worker
        await pg.goto(B+"#/hoy"); await pg.wait_for_timeout(1500)
        sw = await pg.evaluate("navigator.serviceWorker.controller ? 'controla' : 'sin control'")
        await pg.reload(); await pg.wait_for_timeout(800)
        sw = await pg.evaluate("navigator.serviceWorker.controller ? 'controla' : 'sin control'")
        await ctx.set_offline(True); await pg.reload(); await pg.wait_for_timeout(800)
        print("9 sw:", sw, "| offline título:", await t("#titulo-vista"), "| productos:", await pg.evaluate("document.querySelectorAll('.lista-faltantes li').length"))
        await ctx.set_offline(False)
        print("ERRORES:", errs)
        assert not errs, "Hubo errores en la consola"
        await b.close()
asyncio.run(main())
