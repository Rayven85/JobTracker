// Client-only tailored-resume PDF export. Heavy dependency (@react-pdf/renderer) —
// import this module dynamically (await import('@/lib/resume-pdf')) so it stays out of
// the initial bundle. One default single-column template for now; more are backlogged.
import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer'
import type { ExtractedData } from '@/types'
import { descriptionToLines, formatMonthYear } from '@/lib/resume-format'

const styles = StyleSheet.create({
  page: { paddingVertical: 40, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a', lineHeight: 1.4 },
  name: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  contact: { fontSize: 9, color: '#555', marginBottom: 2 },
  summary: { fontSize: 10, color: '#333', marginTop: 6 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1, color: '#111', marginTop: 16, marginBottom: 6, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  skills: { fontSize: 10, color: '#333' },
  expHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
  expTitle: { fontSize: 10.5, fontFamily: 'Helvetica-Bold' },
  expDates: { fontSize: 9, color: '#666' },
  expSub: { fontSize: 9, color: '#666', fontFamily: 'Helvetica-Oblique', marginBottom: 2 },
  bullet: { fontSize: 9.5, color: '#333', marginBottom: 1.5, paddingLeft: 8 },
  entry: { marginBottom: 9 },
  eduRow: { flexDirection: 'row', justifyContent: 'space-between' },
  eduTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  eduSub: { fontSize: 9, color: '#555' },
  certRow: { fontSize: 9.5, color: '#333', marginBottom: 2 },
})

function formatPeriod(start: string | null, end: string | null, current: boolean): string {
  const right = current ? 'Present' : formatMonthYear(end)
  return [formatMonthYear(start), right].filter(Boolean).join(' – ')
}

function bulletsOf(description: unknown): string[] {
  return descriptionToLines(description).map(l => (l.startsWith('•') ? l.replace(/^•\s*/, '') : l))
}

function ResumePdf({ data }: { data: ExtractedData }) {
  const contactLine = [data.email, data.phone, data.location].filter(Boolean).join('  ·  ')
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {data.name && <Text style={styles.name}>{data.name}</Text>}
        {contactLine ? <Text style={styles.contact}>{contactLine}</Text> : null}
        {data.summary ? <Text style={styles.summary}>{data.summary}</Text> : null}

        {data.skills?.length ? (
          <View>
            <Text style={styles.sectionTitle}>Skills</Text>
            <Text style={styles.skills}>{data.skills.join('  ·  ')}</Text>
          </View>
        ) : null}

        {data.experience?.length ? (
          <View>
            <Text style={styles.sectionTitle}>Experience</Text>
            {data.experience.map((e, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <View style={styles.expHeaderRow}>
                  <Text style={styles.expTitle}>{[e.title, e.company].filter(Boolean).join(' — ')}</Text>
                  <Text style={styles.expDates}>{formatPeriod(e.startDate, e.endDate, e.current)}</Text>
                </View>
                {e.location ? <Text style={styles.expSub}>{e.location}</Text> : null}
                {bulletsOf(e.description).map((b, j) => (
                  <Text key={j} style={styles.bullet}>{`• ${b}`}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {data.education?.length ? (
          <View>
            <Text style={styles.sectionTitle}>Education</Text>
            {data.education.map((ed, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <View style={styles.eduRow}>
                  <Text style={styles.eduTitle}>{ed.institution}</Text>
                  <Text style={styles.expDates}>{[ed.startYear, ed.endYear].filter(Boolean).join('–')}</Text>
                </View>
                <Text style={styles.eduSub}>{[ed.degree, ed.field].filter(Boolean).join(' — ')}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {data.certifications?.length ? (
          <View>
            <Text style={styles.sectionTitle}>Certifications & Awards</Text>
            {data.certifications.map((c, i) => (
              <Text key={i} style={styles.certRow}>
                {c.name}{c.issuer ? ` — ${c.issuer}` : ''}{c.year ? ` (${c.year})` : ''}
              </Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  )
}

export async function generateResumePdfBlob(data: ExtractedData): Promise<Blob> {
  return pdf(<ResumePdf data={data} />).toBlob()
}

// Safe, descriptive file name: "resume-company-jobtitle.pdf"
export function resumePdfFileName(company: string, jobTitle: string): string {
  const slug = `${company} ${jobTitle}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `resume-${slug || 'tailored'}.pdf`
}
