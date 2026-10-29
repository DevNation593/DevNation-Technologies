import "server-only";
import { Document, Image, Page, Rect, renderToBuffer, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { barcodeBars } from "./barcode";
import type { RideData, RideRow } from "./ride";

const BARCODE_HEIGHT = 40;
const BORDER = "#94a3b8";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: "Helvetica", color: "#0f172a", lineHeight: 1.35 },
  top: { flexDirection: "row", gap: 10 },
  column: { flex: 1 },
  box: { border: `1 solid ${BORDER}`, borderRadius: 4, padding: 8 },
  logo: { height: 56, marginBottom: 8, objectFit: "contain", objectPosition: "left" },
  logoText: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  bold: { fontFamily: "Helvetica-Bold" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 4, marginBottom: 6 },
  key: { fontSize: 7.5, fontFamily: "Courier" },
  barcode: { width: "100%", height: BARCODE_HEIGHT, marginVertical: 4 },
  warning: { color: "#b45309", marginBottom: 8 },
  table: { marginTop: 10, border: `1 solid ${BORDER}` },
  row: { flexDirection: "row", borderBottom: `1 solid ${BORDER}` },
  lastRow: { flexDirection: "row" },
  head: { backgroundColor: "#f1f5f9", fontFamily: "Helvetica-Bold" },
  cell: { padding: 4 },
  num: { padding: 4, textAlign: "right" },
  bottom: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
});

function Barcode({ value }: { value: string }) {
  const bars = barcodeBars(value);
  const last = bars.at(-1);
  const width = last ? last.x + last.width : 1;
  return (
    <Svg style={styles.barcode} viewBox={`0 0 ${width} ${BARCODE_HEIGHT}`} preserveAspectRatio="none">
      {bars.map((bar) => (
        <Rect key={bar.x} x={bar.x} y={0} width={bar.width} height={BARCODE_HEIGHT} fill="#000" />
      ))}
    </Svg>
  );
}

function Field({ row }: { row: RideRow }) {
  return row.label ? (
    <Text>
      <Text style={styles.bold}>{row.label}: </Text>
      {row.value}
    </Text>
  ) : (
    <Text>{row.value}</Text>
  );
}

/** Tabla simple: `widths` son proporciones (flex) de cada columna; `numeric` alinea a la derecha. */
function Table({
  headers,
  rows,
  widths,
  numeric = [],
  strongLast = false,
}: {
  headers?: string[];
  rows: string[][];
  widths: number[];
  numeric?: number[];
  strongLast?: boolean;
}) {
  const cellStyle = (i: number) => [numeric.includes(i) ? styles.num : styles.cell, { flex: widths[i] }];
  return (
    <View style={styles.table}>
      {headers && (
        <View style={[styles.row, styles.head]} fixed>
          {headers.map((h, i) => (
            <Text key={h} style={cellStyle(i)}>
              {h}
            </Text>
          ))}
        </View>
      )}
      {rows.map((row, r) => {
        const isLast = r === rows.length - 1;
        return (
          <View key={r} style={[isLast ? styles.lastRow : styles.row, strongLast && isLast ? styles.bold : {}]} wrap={false}>
            {row.map((value, i) => (
              <Text key={i} style={cellStyle(i)}>
                {value}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function RideDocument({ data, logoDataUrl }: { data: RideData; logoDataUrl: string }) {
  // react-pdf solo admite PNG y JPG; con otro formato se muestra el nombre.
  const logo = /^data:image\/(png|jpeg);base64,/.test(logoDataUrl) ? logoDataUrl : "";

  return (
    // Fecha fija: el mismo correo automático debe tener el mismo contenido para que la
    // clave de idempotencia de Resend lo reconozca como duplicado.
    <Document
      title={data.fileBase}
      author={data.issuer.razonSocial}
      language="es"
      creationDate={new Date(data.documentDate)}
      modificationDate={new Date(data.documentDate)}
    >
      <Page size="A4" style={styles.page}>
        {!data.authorized && (
          <Text style={styles.warning}>
            Esta factura aún no está autorizada por el SRI: el RIDE no tiene validez hasta su autorización.
          </Text>
        )}
        <View style={styles.top}>
          <View style={styles.column}>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no admite alt.
              <Image src={logo} style={styles.logo} />
            ) : (
              <Text style={styles.logoText}>{data.issuer.nombreComercial || data.issuer.razonSocial}</Text>
            )}
            <View style={styles.box}>
              <Text style={[styles.bold, { fontSize: 10 }]}>{data.issuer.razonSocial}</Text>
              {data.issuer.nombreComercial && <Text>{data.issuer.nombreComercial}</Text>}
              {data.issuer.rows.map((row) => (
                <Field key={row.label || row.value} row={row} />
              ))}
            </View>
          </View>
          <View style={[styles.column, styles.box]}>
            <Field row={{ label: "R.U.C.", value: data.issuer.ruc }} />
            <Text style={styles.title}>FACTURA</Text>
            <Text>
              <Text style={styles.bold}>No. </Text>
              {data.number}
            </Text>
            <Text style={styles.bold}>NÚMERO DE AUTORIZACIÓN</Text>
            <Text style={styles.key}>{data.authorizationNumber}</Text>
            <Field row={{ label: "FECHA Y HORA DE AUTORIZACIÓN", value: data.authorizedAt }} />
            <Field row={{ label: "AMBIENTE", value: data.environment }} />
            <Field row={{ label: "EMISIÓN", value: "NORMAL" }} />
            <Text style={styles.bold}>CLAVE DE ACCESO</Text>
            {data.accessKey && <Barcode value={data.accessKey} />}
            <Text style={styles.key}>{data.accessKey}</Text>
          </View>
        </View>

        <View style={[styles.box, { marginTop: 10 }]}>
          <Field row={{ label: "Razón social / Nombres y apellidos", value: data.buyer.name }} />
          <Field row={{ label: data.buyer.idLabel, value: data.buyer.identification }} />
          <Field row={{ label: "Fecha de emisión", value: data.issueDate }} />
          {data.buyer.address && <Field row={{ label: "Dirección", value: data.buyer.address }} />}
        </View>

        <Table
          headers={["Cód. principal", "Cant.", "Descripción", "Precio unitario", "Descuento", "Precio total"]}
          rows={data.lines.map((l) => [l.code, l.quantity, l.description, l.unitPrice, l.discount, l.total])}
          widths={[1.2, 0.8, 4, 1.2, 1, 1.1]}
          numeric={[1, 3, 4, 5]}
        />

        <View style={styles.bottom} wrap={false}>
          <View style={{ flex: 1.4 }}>
            {data.additionalInfo.length > 0 && (
              <Table
                headers={["Información adicional", ""]}
                rows={data.additionalInfo.map((f) => [f.name, f.value])}
                widths={[1, 2]}
              />
            )}
            <Table
              headers={["Forma de pago", "Valor", "Plazo"]}
              rows={data.payments.map((p) => [p.label, p.amount, p.term])}
              widths={[3, 1, 1]}
              numeric={[1]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Table rows={data.totals.map((t) => [t.label, t.value])} widths={[2, 1]} numeric={[1]} strongLast />
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** Genera el RIDE en PDF (A4) a partir de los mismos datos que la página del RIDE. */
export function renderRidePdf(data: RideData, logoDataUrl: string): Promise<Buffer> {
  return renderToBuffer(<RideDocument data={data} logoDataUrl={logoDataUrl} />);
}
