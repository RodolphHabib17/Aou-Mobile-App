const express = require('express');
const sqlite = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();



// CORS configuration 
app.use(cors({
    origin: [
        'http://10.0.2.2:4000',          // Android emulator
        'http://172.17.0.53:4000',    // Your specific IP
        'http://localhost:4000',         // Localhost   
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'Origin', 
        'X-Requested-With', 
        'Accept'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Enable CORS support
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', true);
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

// Simple logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, {
        headers: req.headers,
        body: req.body,
        query: req.query
    });
    next();
});

// Middleware to parse JSON
app.use(express.json());


app.use((req, res, next) => {
    console.log('Incoming request:', {
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body
    });
    next();
});

// Connect to the SQLite database
const db = new sqlite.Database('./aou.db', sqlite.OPEN_READWRITE | sqlite.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
        process.exit(1);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Execute table creation in sequence
        db.serialize(() => {
            // Drop existing tables
            db.run('DROP TABLE IF EXISTS users', err => {
                if (err) console.error('Error dropping users table:', err.message);
            });

            db.run('DROP TABLE IF EXISTS CourseTable', err => {
                if (err) console.error('Error dropping courses table:', err.message);
            });

            db.run('DROP TABLE IF EXISTS LessonTable', err => {
                if (err) console.error('Error dropping lessons table:', err.message);
            });

            // Create users table
            const createUsersTableSql = `
                CREATE TABLE IF NOT EXISTS users (
                    ID INTEGER PRIMARY KEY AUTOINCREMENT,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    major TEXT NOT NULL,
                    is_admin INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            // Create updated courses table
            const createCoursesTableSql = `
                CREATE TABLE IF NOT EXISTS CourseTable (
                    "Course-ID" INTEGER PRIMARY KEY AUTOINCREMENT,
                    "Course-name" TEXT NOT NULL,
                    "Course-description" TEXT,
                    "Course-image" TEXT,
                    "Course-duration" TEXT,
                    "users-id" INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY ("users-id") REFERENCES users(ID)
                )
            `;

            // Create lessons table
            const createLessonsTableSql = `
                CREATE TABLE IF NOT EXISTS LessonTable (
                    lesson_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    course_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    duration TEXT,
                    text_content TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (course_id) REFERENCES CourseTable("Course-ID") ON DELETE CASCADE
                )
            `;

            // Create lesson resources table
            const createResourcesTableSql = `
                CREATE TABLE IF NOT EXISTS ResourceTable (
                    resource_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lesson_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    type TEXT,
                    description TEXT,
                    content TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (lesson_id) REFERENCES LessonTable(lesson_id) ON DELETE CASCADE
                )
            `;

            // Create key points table
            const createKeyPointsTableSql = `
                CREATE TABLE IF NOT EXISTS KeyPointTable (
                    point_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lesson_id INTEGER NOT NULL,
                    point_text TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (lesson_id) REFERENCES LessonTable(lesson_id) ON DELETE CASCADE
                )
            `;

            // Create user notes table
            const createUserNotesTableSql = `
                CREATE TABLE IF NOT EXISTS user_notes (
                    note_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    course_id INTEGER NOT NULL,
                    lesson_id INTEGER NOT NULL,
                    note_content TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(ID),
                    FOREIGN KEY (course_id) REFERENCES CourseTable("Course-ID"),
                    FOREIGN KEY (lesson_id) REFERENCES LessonTable(lesson_id),
                    CONSTRAINT unique_user_lesson UNIQUE (user_id, lesson_id)
                )
            `;

            db.run(createUsersTableSql, err => {
                if (err) console.error('Error creating users table:', err.message);
                else console.log('Users table created successfully.');
            });

            db.run(createCoursesTableSql, err => {
                if (err) console.error('Error creating courses table:', err.message);
                else console.log('Courses table created successfully.');
            });

            db.run(createLessonsTableSql, err => {
                if (err) console.error('Error creating lessons table:', err.message);
                else console.log('Lessons table created successfully.');
            });

            db.run(createResourcesTableSql, err => {
                if (err) console.error('Error creating resources table:', err.message);
                else console.log('Resources table created successfully.');
            });

            db.run(createKeyPointsTableSql, err => {
                if (err) console.error('Error creating key points table:', err.message);
                else console.log('Key points table created successfully.');
            });

            db.run(createUserNotesTableSql, err => {
                if (err) console.error('Error creating user notes table:', err.message);
                else console.log('User notes table created successfully.');
            });
        });
    }
});

// Modify the JWT_SECRET constant to be more secure
const JWT_SECRET = process.env.JWT_SECRET || 'a-more-secure-secret-key-12345';

// POST request for user signup
app.post('/signup', async (req, res) => {
    try {
        const { first_name, last_name, email, password, major } = req.body;


        if (!first_name || !last_name || !email || !password || !major) {
            return res.status(400).json({
                status: 400,
                success: false,
                error: 'All fields are required.',
            });
        }

        // Check if email already exists
        const checkEmail = 'SELECT email FROM users WHERE email = ?';
        db.get(checkEmail, [email], async (err, row) => {
            if (err) {
                return res.status(500).json({
                    status: 500,
                    success: false,
                    error: err.message,
                });
            }

            if (row) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    error: 'Email already exists',
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);


            const sql = `
                INSERT INTO users (first_name, last_name, email, password, major)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            db.run(sql, [first_name, last_name, email, hashedPassword, major], function (err) {
                if (err) {
                    return res.status(500).json({
                        status: 500,
                        success: false,
                        error: err.message,
                    });
                }

                res.status(201).json({
                    status: 201,
                    success: true,
                    message: 'User registered successfully',
                    userId: this.lastID,
                });
            });
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            success: false,
            error: 'An unexpected error occurred.',
        });
    }
});

// POST request for user signin
app.post('/signin', (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                status: 400,
                success: false,
                error: 'Email and password are required.',
            });
        }

        const sql = `
            SELECT ID, first_name, last_name, email, password, major, is_admin, created_at 
            FROM users 
            WHERE email = ?
        `;
        
        db.get(sql, [email], async (err, user) => {
            if (err) {
                return res.status(500).json({
                    status: 500,
                    success: false,
                    error: err.message,
                });
            }

            if (!user) {
                return res.status(401).json({
                    status: 401,
                    success: false,
                    error: 'Invalid email or password',
                });
            }

            // Compare password
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({
                    status: 401,
                    success: false,
                    error: 'Invalid email or password',
                });
            }

            // Modified isAdmin check
            const isAdminValue = Boolean(user.is_admin); 

            console.log('User data:', user); 
            console.log('Is admin value:', isAdminValue); 

            const token = jwt.sign(
                { 
                    userId: user.ID,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    isAdmin: isAdminValue
                },
                JWT_SECRET,
                { 
                    expiresIn: '24h',
                    algorithm: 'HS256'
                }
            );

            delete user.password;
            res.json({
                status: 200,
                success: true,
                message: 'Signed in successfully',
                user: {
                    ...user,
                    is_admin: Boolean(user.is_admin) 
                },
                isAdmin: Boolean(user.is_admin), 
                token: token
            });
        });
    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({
            status: 500,
            success: false,
            error: 'An unexpected error occurred.',
        });
    }
});

//  create admin user 
app.post('/create-admin', async (req, res) => {
    try {
        const { first_name, last_name, email, password, major } = req.body;

        if (!first_name || !last_name || !email || !password || !major) {
            return res.status(400).json({
                status: 400,
                success: false,
                error: 'All fields are required.',
            });
        }

        // Check if email already exists
        const checkEmail = 'SELECT email FROM users WHERE email = ?';
        db.get(checkEmail, [email], async (err, row) => {
            if (err) {
                return res.status(500).json({
                    status: 500,
                    success: false,
                    error: err.message,
                });
            }

            if (row) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    error: 'Email already exists',
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            const sql = `
                INSERT INTO users (first_name, last_name, email, password, major, is_admin)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            // Explicitly pass 1 for is_admin
            db.run(sql, [first_name, last_name, email, hashedPassword, major, 1], function (err) {
                if (err) {
                    return res.status(500).json({
                        status: 500,
                        success: false,
                        error: err.message,
                    });
                }

                // Verify the admin was created correctly
                db.get('SELECT * FROM users WHERE ID = ?', [this.lastID], (err, user) => {
                    if (err) {
                        console.error('Error verifying admin creation:', err);
                    } else {
                        console.log('Created admin user:', user);
                    }
                });

                res.status(201).json({
                    status: 201,
                    success: true,
                    message: 'Admin user created successfully',
                    userId: this.lastID,
                });
            });
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            success: false,
            error: 'An unexpected error occurred.',
        });
    }
});

// Update the isAdmin middleware to use JWT token
const isAdmin = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: 401,
                success: false,
                error: 'Authentication required'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        if (!decoded.isAdmin) {
            return res.status(403).json({
                status: 403,
                success: false,
                error: 'Admin access required'
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            status: 401,
            success: false,
            error: 'Invalid or expired token'
        });
    }
};

// auth middleware for protected routes
const auth = (req, res, next) => {
    try {
        console.log('Auth middleware - headers:', req.headers); 
        
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('Missing or invalid auth header'); 
            return res.status(401).json({
                status: 401,
                success: false,
                error: 'Authentication required'
            });
        }

        const token = authHeader.split(' ')[1];
        console.log('Token:', token); 
        
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Decoded token:', decoded); 
        
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error); 
        return res.status(401).json({
            status: 401,
            success: false,
            error: 'Invalid or expired token'
        });
    }
};

//  Getting admin-only endpoint
app.get('/admin/users', isAdmin, (req, res) => {
    const sql = "SELECT ID, first_name, last_name, email, major, created_at, is_admin FROM users";
    try {
        db.all(sql, [], (err, rows) => {
            if (err) {
                return res.status(500).json({
                    status: 500,
                    success: false,
                    error: err.message,
                });
            }
            return res.json({
                status: 200,
                success: true,
                data: rows
            });
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            success: false,
            error: 'An unexpected error occurred.',
        });
    }
});

//get request to see the users
app.get('/users',(req,res)=>{
    const sql = "SELECT * FROM users";  
    try {
        db.all(sql,[],(err,rows)=>{
            if (err) {
                return res.status(500).json({
                    status: 500,
                    success: false,
                    error: err.message,
                });
            }
            if(rows.length < 1) 
                return res.json({status:300,success:false,error:"No match"})

            return res.json({status:true,data:rows,success:true})
        })
    } catch (error) {
        res.status(500).json({
            status: 500,
            success: false,
            error: 'An unexpected error occurred.',
        });
    }
});

// token verification endpoint
app.post('/verify-token', auth, (req, res) => {
    try {
        res.json({
            status: 200,
            success: true,
            user: req.user
        });
    } catch (error) {
        res.status(401).json({
            status: 401,
            success: false,
            error: 'Invalid token'
        });
    }
});

// Add logout endpoint 
app.post('/logout', auth, (req, res) => {
    res.json({
        status: 200,
        success: true,
        message: 'Logged out successfully'
    });
});

// Add this temporary endpoint to check user details 
app.get('/check-user/:email', (req, res) => {
    const sql = 'SELECT ID, email, is_admin FROM users WHERE email = ?';
    db.get(sql, [req.params.email], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(user);
    });
});


// Create a new course (admin only)
app.post('/courses', isAdmin, async (req, res) => {
    try {
        const { 
            courseName, 
            courseDescription, 
            courseImage, 
            courseDuration,
            userId,
            lessons 
        } = req.body;

        if (!courseName) {
            return res.status(400).json({
                status: 400,
                success: false,
                error: 'Course name is required'
            });
        }

        // Start a transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Insert course
            const courseSQL = `
                INSERT INTO CourseTable (
                    "Course-name", 
                    "Course-description", 
                    "Course-image", 
                    "Course-duration",
                    "users-id"
                ) VALUES (?, ?, ?, ?, ?)
            `;

            db.run(courseSQL, 
                [courseName, courseDescription, courseImage, courseDuration, userId], 
                function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({
                            status: 500,
                            success: false,
                            error: err.message
                        });
                    }

                    const courseId = this.lastID;
                    if (lessons && lessons.length > 0) {
                        const lessonSQL = `
                            INSERT INTO LessonTable (
                                course_id, 
                                title, 
                                duration, 
                                text_content
                            ) VALUES (?, ?, ?, ?)
                        `;

                        lessons.forEach(lesson => {
                            db.run(lessonSQL, 
                                [courseId, lesson.title, lesson.duration, lesson.textContent],
                                function(err) {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return res.status(500).json({
                                            status: 500,
                                            success: false,
                                            error: err.message
                                        });
                                    }

                                    const lessonId = this.lastID;

                                    // Insert key points
                                    if (lesson.keyPoints && lesson.keyPoints.length > 0) {
                                        const keyPointSQL = `
                                            INSERT INTO KeyPointTable (
                                                lesson_id, 
                                                point_text
                                            ) VALUES (?, ?)
                                        `;

                                        lesson.keyPoints.forEach(point => {
                                            db.run(keyPointSQL, [lessonId, point]);
                                        });
                                    }

                                    // Insert resources
                                    if (lesson.resources && lesson.resources.length > 0) {
                                        const resourceSQL = `
                                            INSERT INTO ResourceTable (
                                                lesson_id,
                                                title,
                                                type,
                                                description,
                                                content
                                            ) VALUES (?, ?, ?, ?, ?)
                                        `;

                                        lesson.resources.forEach(resource => {
                                            db.run(resourceSQL, [
                                                lessonId,
                                                resource.title,
                                                resource.type,
                                                resource.description,
                                                resource.content
                                            ]);
                                        });
                                    }
                                }
                            );
                        });
                    }

                    db.run('COMMIT');
                    res.status(201).json({
                        status: 201,
                        success: true,
                        message: 'Course created successfully',
                        courseId: courseId
                    });
                }
            );
        });
    } catch (error) {
        db.run('ROLLBACK');
        res.status(500).json({
            status: 500,
            success: false,
            error: 'An unexpected error occurred.'
        });
    }
});

// Get all courses with their lessons and details
app.get('/courses', (req, res) => {
    const sql = `
        SELECT 
            c.*,
            l.lesson_id,
            l.title as lesson_title,
            l.duration as lesson_duration,
            l.text_content,
            k.point_text,
            r.title as resource_title,
            r.type as resource_type,
            r.description as resource_description,
            r.content as resource_content
        FROM CourseTable c
        LEFT JOIN LessonTable l ON c."Course-ID" = l.course_id
        LEFT JOIN KeyPointTable k ON l.lesson_id = k.lesson_id
        LEFT JOIN ResourceTable r ON l.lesson_id = r.lesson_id
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({
                status: 500,
                success: false,
                error: err.message
            });
        }

        // Transform the flat data into nested structure
        const courses = rows.reduce((acc, row) => {
            let course = acc.find(c => c['Course-ID'] === row['Course-ID']);
            
            if (!course) {
                course = {
                    'Course-ID': row['Course-ID'],
                    'Course-name': row['Course-name'],
                    'Course-description': row['Course-description'],
                    'Course-image': row['Course-image'],
                    'Course-duration': row['Course-duration'],
                    'users-id': row['users-id'],
                    lessons: []
                };
                acc.push(course);
            }

            if (row.lesson_id) {
                let lesson = course.lessons.find(l => l.lesson_id === row.lesson_id);
                
                if (!lesson) {
                    lesson = {
                        lesson_id: row.lesson_id,
                        title: row.lesson_title,
                        duration: row.lesson_duration,
                        text_content: row.text_content,
                        keyPoints: [],
                        resources: []
                    };
                    course.lessons.push(lesson);
                }

                if (row.point_text && !lesson.keyPoints.includes(row.point_text)) {
                    lesson.keyPoints.push(row.point_text);
                }

                if (row.resource_title) {
                    const resource = {
                        title: row.resource_title,
                        type: row.resource_type,
                        description: row.resource_description,
                        content: row.resource_content
                    };
                    if (!lesson.resources.some(r => r.title === resource.title)) {
                        lesson.resources.push(resource);
                    }
                }
            }

            return acc;
        }, []);

        res.json({
            status: 200,
            success: true,
            data: courses
        });
    });
});

// Get a specific course with all its details
app.get('/courses/:id', (req, res) => {
    const courseId = req.params.id;
    const sql = `
        SELECT 
            c.*,
            l.lesson_id,
            l.title as lesson_title,
            l.duration as lesson_duration,
            l.text_content,
            k.point_text,
            r.title as resource_title,
            r.type as resource_type,
            r.description as resource_description,
            r.content as resource_content
        FROM CourseTable c
        LEFT JOIN LessonTable l ON c."Course-ID" = l.course_id
        LEFT JOIN KeyPointTable k ON l.lesson_id = k.lesson_id
        LEFT JOIN ResourceTable r ON l.lesson_id = r.lesson_id
        WHERE c."Course-ID" = ?
    `;
    
    db.all(sql, [courseId], (err, rows) => {
        if (err) {
            return res.status(500).json({
                status: 500,
                success: false,
                error: err.message
            });
        }

        if (rows.length === 0) {
            return res.status(404).json({
                status: 404,
                success: false,
                error: 'Course not found'
            });
        }

        // Transform the data into nested structure
        const course = {
            'Course-ID': rows[0]['Course-ID'],
            'Course-name': rows[0]['Course-name'],
            'Course-description': rows[0]['Course-description'],
            'Course-image': rows[0]['Course-image'],
            'Course-duration': rows[0]['Course-duration'],
            'users-id': rows[0]['users-id'],
            lessons: []
        };

        rows.forEach(row => {
            if (row.lesson_id) {
                let lesson = course.lessons.find(l => l.lesson_id === row.lesson_id);
                
                if (!lesson) {
                    lesson = {
                        lesson_id: row.lesson_id,
                        title: row.lesson_title,
                        duration: row.lesson_duration,
                        text_content: row.text_content,
                        keyPoints: [],
                        resources: []
                    };
                    course.lessons.push(lesson);
                }

                if (row.point_text && !lesson.keyPoints.includes(row.point_text)) {
                    lesson.keyPoints.push(row.point_text);
                }

                if (row.resource_title) {
                    const resource = {
                        title: row.resource_title,
                        type: row.resource_type,
                        description: row.resource_description,
                        content: row.resource_content
                    };
                    if (!lesson.resources.some(r => r.title === resource.title)) {
                        lesson.resources.push(resource);
                    }
                }
            }
        });

        res.json({
            status: 200,
            success: true,
            data: course
        });
    });
});

// Update a course (admin only)
app.put('/courses/:id', isAdmin, (req, res) => {
    const courseId = req.params.id;
    const { 
        courseName, 
        courseDescription, 
        courseImage, 
        courseDuration,
        userId,
        lessons 
    } = req.body;
    
    if (!courseName) {
        return res.status(400).json({
            status: 400,
            success: false,
            error: 'Course name is required'
        });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Update course
        const courseSQL = `
            UPDATE CourseTable 
            SET "Course-name" = ?,
                "Course-description" = ?,
                "Course-image" = ?,
                "Course-duration" = ?,
                "users-id" = ?
            WHERE "Course-ID" = ?
        `;

        db.run(courseSQL, 
            [courseName, courseDescription, courseImage, courseDuration, userId, courseId],
            function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({
                        status: 500,
                        success: false,
                        error: err.message
                    });
                }

                if (this.changes === 0) {
                    db.run('ROLLBACK');
                    return res.status(404).json({
                        status: 404,
                        success: false,
                        error: 'Course not found'
                    });
                }

                // Delete existing lessons and related data
                db.run('DELETE FROM LessonTable WHERE course_id = ?', [courseId], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({
                            status: 500,
                            success: false,
                            error: err.message
                        });
                    }

                    // Insert updated lessons
                    if (lessons && lessons.length > 0) {
                        const lessonSQL = `
                            INSERT INTO LessonTable (
                                course_id, 
                                title, 
                                duration, 
                                text_content
                            ) VALUES (?, ?, ?, ?)
                        `;

                        lessons.forEach(lesson => {
                            db.run(lessonSQL, 
                                [courseId, lesson.title, lesson.duration, lesson.textContent],
                                function(err) {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return res.status(500).json({
                                            status: 500,
                                            success: false,
                                            error: err.message
                                        });
                                    }

                                    const lessonId = this.lastID;

                                    // Insert key points
                                    if (lesson.keyPoints && lesson.keyPoints.length > 0) {
                                        const keyPointSQL = `
                                            INSERT INTO KeyPointTable (
                                                lesson_id, 
                                                point_text
                                            ) VALUES (?, ?)
                                        `;

                                        lesson.keyPoints.forEach(point => {
                                            db.run(keyPointSQL, [lessonId, point]);
                                        });
                                    }

                                    // Insert resources
                                    if (lesson.resources && lesson.resources.length > 0) {
                                        const resourceSQL = `
                                            INSERT INTO ResourceTable (
                                                lesson_id,
                                                title,
                                                type,
                                                description,
                                                content
                                            ) VALUES (?, ?, ?, ?, ?)
                                        `;

                                        lesson.resources.forEach(resource => {
                                            db.run(resourceSQL, [
                                                lessonId,
                                                resource.title,
                                                resource.type,
                                                resource.description,
                                                resource.content
                                            ]);
                                        });
                                    }
                                }
                            );
                        });
                    }

                    db.run('COMMIT');
                    res.json({
                        status: 200,
                        success: true,
                        message: 'Course updated successfully'
                    });
                });
            }
        );
    });
});

// Delete a course and all related data (admin only)
app.delete('/courses/:id', isAdmin, (req, res) => {
    const courseId = req.params.id;
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const sql = `DELETE FROM CourseTable WHERE "Course-ID" = ?`;
        
        db.run(sql, [courseId], function(err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({
                    status: 500,
                    success: false,
                    error: err.message
                });
            }

            if (this.changes === 0) {
                db.run('ROLLBACK');
                return res.status(404).json({
                    status: 404,
                    success: false,
                    error: 'Course not found'
                });
            }

            db.run('COMMIT');
            res.json({
                status: 200,
                success: true,
                message: 'Course and all related data deleted successfully'
            });
        });
    });
});

// Add user (admin only)
app.post('/admin/users', isAdmin, async (req, res) => {
    try {
        const { first_name, last_name, email, password, major, is_admin } = req.body;

        // Validate input
        if (!first_name || !last_name || !email || !password || !major) {
            return res.status(400).json({
                status: 400,
                success: false,
                error: 'All fields are required.',
            });
        }

        // Check if email already exists
        const checkEmail = 'SELECT email FROM users WHERE email = ?';
        db.get(checkEmail, [email], async (err, row) => {
            if (err) {
                return res.status(500).json({
                    status: 500,
                    success: false,
                    error: err.message,
                });
            }

            if (row) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    error: 'Email already exists',
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            const sql = `
                INSERT INTO users (first_name, last_name, email, password, major, is_admin)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            db.run(sql, [first_name, last_name, email, hashedPassword, major, is_admin ? 1 : 0], function(err) {
                if (err) {
                    return res.status(500).json({
                        status: 500,
                        success: false,
                        error: err.message,
                    });
                }

                res.status(201).json({
                    status: 201,
                    success: true,
                    message: 'User created successfully',
                    userId: this.lastID,
                });
            });
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            success: false,
            error: 'An unexpected error occurred.',
        });
    }
});

// Get all users (admin only)
app.get('/admin/users', isAdmin, (req, res) => {
    const sql = `
        SELECT ID, first_name, last_name, email, major, is_admin, created_at 
        FROM users
    `;
    
    db.all(sql, [], (err, users) => {
        if (err) {
            return res.status(500).json({
                status: 500,
                success: false,
                error: err.message
            });
        }

        res.json({
            status: 200,
            success: true,
            data: users
        });
    });
});

// Get specific user (admin only)
app.get('/admin/users/:id', isAdmin, (req, res) => {
    const sql = `
        SELECT ID, first_name, last_name, email, major, is_admin, created_at 
        FROM users 
        WHERE ID = ?
    `;
    
    db.get(sql, [req.params.id], (err, user) => {
        if (err) {
            return res.status(500).json({
                status: 500,
                success: false,
                error: err.message
            });
        }

        if (!user) {
            return res.status(404).json({
                status: 404,
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            status: 200,
            success: true,
            data: user
        });
    });
});

// Update user (admin only)
app.put('/admin/users/:id', isAdmin, async (req, res) => {
    try {
        const { first_name, last_name, email, major, is_admin } = req.body;
        const userId = req.params.id;

        console.log('Received update request for user:', userId, req.body); // Debug log

        // Validate input
        if (!first_name || !last_name || !email || !major) {
            return res.status(400).json({
                status: 400,
                success: false,
                error: 'All fields are required'
            });
        }

        // First check if the user exists
        const checkUser = 'SELECT * FROM users WHERE ID = ?';
        db.get(checkUser, [userId], async (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({
                    status: 500,
                    success: false,
                    error: err.message
                });
            }

            if (!user) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    error: 'User not found'
                });
            }

            // Check if email exists for other users
            const checkEmail = 'SELECT email FROM users WHERE email = ? AND ID != ?';
            db.get(checkEmail, [email, userId], async (err, row) => {
                if (err) {
                    return res.status(500).json({
                        status: 500,
                        success: false,
                        error: err.message
                    });
                }

                if (row) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        error: 'Email already exists'
                    });
                }

                const sql = `
                    UPDATE users 
                    SET first_name = ?,
                        last_name = ?,
                        email = ?,
                        major = ?,
                        is_admin = ?
                    WHERE ID = ?
                `;

                db.run(sql, [
                    first_name,
                    last_name,
                    email,
                    major,
                    is_admin ? 1 : 0,
                    userId
                ], function(err) {
                    if (err) {
                        console.error('Update error:', err);
                        return res.status(500).json({
                            status: 500,
                            success: false,
                            error: err.message
                        });
                    }

                    if (this.changes === 0) {
                        return res.status(404).json({
                            status: 404,
                            success: false,
                            error: 'User not found'
                        });
                    }

                    res.json({
                        status: 200,
                        success: true,
                        message: 'User updated successfully'
                    });
                });
            });
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({
            status: 500,
            success: false,
            error: 'An unexpected error occurred.'
        });
    }
});

// Delete user (admin only)
app.delete('/admin/users/:id', isAdmin, (req, res) => {
    const sql = `DELETE FROM users WHERE ID = ?`;
    
    db.run(sql, [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({
                status: 500,
                success: false,
                error: err.message
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                status: 404,
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            status: 200,
            success: true,
            message: 'User deleted successfully'
        });
    });
});
app.post('/notes', auth, async (req, res) => {
    try {
        const { course_id, lesson_id, note_content } = req.body;
        const user_id = req.user.userId;

        console.log('Creating/updating note:', { user_id, course_id, lesson_id, note_content });

        if (!course_id || !lesson_id || !note_content) {
            return res.status(400).json({
                status: 400,
                success: false,
                error: 'Missing required fields'
            });
        }

        // Check if note already exists
        const checkSql = 'SELECT note_id FROM user_notes WHERE user_id = ? AND lesson_id = ?';
        
        db.get(checkSql, [user_id, lesson_id], (err, existingNote) => {
            if (err) {
                console.error('Error checking existing note:', err);
                return res.status(500).json({
                    status: 500,
                    success: false,
                    error: err.message
                });
            }

            if (existingNote) {
                const updateSql = `
                    UPDATE user_notes 
                    SET note_content = ?, 
                        updated_at = CURRENT_TIMESTAMP 
                    WHERE user_id = ? AND lesson_id = ?
                `;
                
                db.run(updateSql, [note_content, user_id, lesson_id], (err) => {
                    if (err) {
                        console.error('Error updating note:', err);
                        return res.status(500).json({
                            status: 500,
                            success: false,
                            error: err.message
                        });
                    }

                    res.json({
                        status: 200,
                        success: true,
                        message: 'Note updated successfully'
                    });
                });
            } else {
                // Create new note
                const insertSql = `
                    INSERT INTO user_notes (user_id, course_id, lesson_id, note_content)
                    VALUES (?, ?, ?, ?)
                `;
                
                db.run(insertSql, [user_id, course_id, lesson_id, note_content], function(err) {
                    if (err) {
                        console.error('Error creating note:', err);
                        return res.status(500).json({
                            status: 500,
                            success: false,
                            error: err.message
                        });
                    }

                    res.status(201).json({
                        status: 201,
                        success: true,
                        message: 'Note created successfully',
                        noteId: this.lastID
                    });
                });
            }
        });
    } catch (error) {
        console.error('Note creation error:', error);
        res.status(500).json({
            status: 500,
            success: false,
            error: 'An unexpected error occurred.'
        });
    }
});

// Get notes for a specific lesson
app.get('/notes/:lessonId', auth, (req, res) => {
    const user_id = req.user.userId;
    const lesson_id = req.params.lessonId;

    console.log('Fetching notes for:', { user_id, lesson_id });

    const sql = `
        SELECT 
            n.*,
            c."Course-name" as course_name,
            l.title as lesson_title
        FROM user_notes n
        JOIN CourseTable c ON n.course_id = c."Course-ID"
        JOIN LessonTable l ON n.lesson_id = l.lesson_id
        WHERE n.user_id = ? AND n.lesson_id = ?
    `;

    db.get(sql, [user_id, lesson_id], (err, note) => {
        if (err) {
            console.error('Error fetching note:', err);
            return res.status(500).json({
                status: 500,
                success: false,
                error: err.message
            });
        }

        res.json({
            status: 200,
            success: true,
            data: note || null
        });
    });
});

// Get all notes for a user
app.get('/notes', auth, (req, res) => {
    const user_id = req.user.userId;

    const sql = `
        SELECT 
            n.*,
            c."Course-name" as course_name,
            l.title as lesson_title
        FROM user_notes n
        JOIN CourseTable c ON n.course_id = c."Course-ID"
        JOIN LessonTable l ON n.lesson_id = l.lesson_id
        WHERE n.user_id = ?
        ORDER BY n.updated_at DESC
    `;

    db.all(sql, [user_id], (err, notes) => {
        if (err) {
            console.error('Error fetching notes:', err);
            return res.status(500).json({
                status: 500,
                success: false,
                error: err.message
            });
        }

        res.json({
            status: 200,
            success: true,
            data: notes || []
        });
    });
});



app.use((req, res) => {
    res.status(404).json({
        status: 404,
        success: false,
        error: 'Route not found'
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 500,
        success: false,
        error: 'Something broke on the server!'
    });
});
// Update a tutor 
app.put('/admin/tutors/:id', isAdmin, (req, res) => {
    const tutorId = req.params.id;
    if (!tutorId) {
        return res.status(400).json({ status: 400, success: false, error: 'Invalid tutor ID' });
    }
    const { first_name, last_name, email, specialization, bio, profile_image } = req.body;

// Check if the tutor exists
const checkTutorSql = 'SELECT * FROM tutors WHERE ID = ?';
db.get(checkTutorSql, [tutorId], (err, tutor) => {
    if (err) {
        return res.status(500).json({ status: 500, success: false, error: err.message });
    }

    if (!tutor) {
        return res.status(404).json({ status: 404, success: false, error: 'Tutor not found' });
    }


    const updateSql = `
        UPDATE tutors
        SET first_name = ?, last_name = ?, email = ?, specialization = ?, bio = ?, profile_image = ?
        WHERE ID = ?
    `;

    db.run(updateSql, [first_name, last_name, email, specialization, bio, profile_image, tutorId], function(err) {
        if (err) {
            return res.status(500).json({ status: 500, success: false, error: err.message });
        }

        res.json({ status: 200, success: true, message: 'Tutor updated successfully' });
    });
});
});

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0'; 

app.listen(PORT, HOST, () => {
    const localIP = getLocalIP();
    console.log('\nServer is running on:');
    console.log(`🌐 Web Browser:       http://localhost:${PORT}`);
    console.log(`📱 Android Emulator:  http://10.0.2.2:${PORT}`);
    console.log(`📱 iOS Simulator:     http://localhost:${PORT}`);
    console.log(`🔌 Local Network:     http://${localIP}:${PORT}`);
    console.log(`\nExpo URLs:`);
    console.log(`📱 Android Emulator:  exp://10.0.2.2:${PORT}`);
    console.log(`📱 iOS Simulator:     exp://localhost:${PORT}`);
    console.log(`🔌 Local Network:     exp://${localIP}:${PORT}`);
    console.log('\nAPI Status:         🟢 Online\n');
});

// Enhanced getLocalIP function
function getLocalIP() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    let localIP = 'localhost';
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                if (net.address.startsWith('192.168.') || 
                    net.address.startsWith('10.') || 
                    net.address.startsWith('172.')) {
                    localIP = net.address;
                    break;
                }
            }
        }
    }
    return localIP;
}
