import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Odessa Symphony Guild'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #2d3748 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '40px',
          }}
        >
          <img
            src="https://odessasymphonyguild.org/images/osg-logo.png"
            alt="OSG Logo"
            width="200"
            height="200"
            style={{
              borderRadius: '20px',
              backgroundColor: 'white',
              padding: '20px',
            }}
          />
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 300,
            letterSpacing: '0.1em',
            color: 'white',
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
        >
          Odessa <span style={{ color: '#d4af37' }}>Symphony Guild</span>
        </div>
        <div
          style={{
            fontSize: 32,
            color: '#d4af37',
            marginTop: '30px',
            textAlign: 'center',
            letterSpacing: '0.05em',
          }}
        >
          Supporting Classical Music in West Texas
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}