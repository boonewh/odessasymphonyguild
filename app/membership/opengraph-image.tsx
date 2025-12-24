import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Membership - Odessa Symphony Guild'
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
            width="160"
            height="160"
            style={{
              borderRadius: '20px',
              backgroundColor: 'white',
              padding: '20px',
            }}
          />
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 300,
            letterSpacing: '0.1em',
            color: 'white',
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
        >
          Membership
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#d4af37',
            marginTop: '30px',
            textAlign: 'center',
            letterSpacing: '0.05em',
          }}
        >
          Odessa Symphony Guild
        </div>
        <div
          style={{
            fontSize: 24,
            color: '#ffffff',
            opacity: 0.8,
            marginTop: '20px',
            textAlign: 'center',
          }}
        >
          Join Our Community of Music Supporters
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}