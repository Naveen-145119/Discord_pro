// Auth layout - minimal layout for login/register pages
export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#5865F2]">
            <div className="w-full max-w-md">
                {children}
            </div>
        </div>
    );
}
