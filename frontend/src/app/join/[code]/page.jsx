import MeetingLobby from "@/components/meeting/MeetingLobby";

export default async function Page({ params }) {
  const { code } = await params;
  return <MeetingLobby code={code} />;
}
